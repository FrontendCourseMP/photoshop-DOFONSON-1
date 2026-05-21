import React, { useState, useRef, ChangeEvent, useCallback, useEffect } from 'react';
import {
    Paper,
    Typography,
    Button,
    Box,
    Grid,
    Alert,
    CircularProgress,
    Divider,
    Chip,
    Stack,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    Table,
    TableBody,
    TableRow,
    TableCell,
    styled,
} from '@mui/material';
import {
    Upload as UploadIcon,
    Download as DownloadIcon,
    Image as ImageIcon,
    Info as InfoIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    ColorLens as ColorLensIcon,
    Opacity as OpacityIcon,
    BarChart as LevelsIcon,
    Gradient as KernelIcon,
} from '@mui/icons-material';
import LevelsDialog from './LevelsDialog';
import ScaleModal from './ScaleModal';
import ScaleControl from './ScaleControl';
import ImageCanvas, { ImageCanvasRef } from './ImageCanvas';
import ImageInfo from './ImageInfo';
import { convertToGrayscale, scaleImage } from '../utils/interpolation';
import ConvolutionModal from './ConvolutionModal';

interface ImageInfoData {
    width: number;
    height: number;
    colorDepth: number;
    fileSize: number;
    fileName: string;
    fileType: string;
    hasMask?: boolean;
}

interface GrayBitHeader {
    signature: Uint8Array;
    version: number;
    flags: number;
    width: number;
    height: number;
    reserved: number;
    hasMask: boolean;
}

interface ChannelState {
    red: boolean;
    green: boolean;
    blue: boolean;
    alpha: boolean;
}

interface ColorInfo {
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
    a: number;
    lab: { L: number; a: number; b: number };
}

const rgbToLab = (r: number, g: number, b: number): { L: number; a: number; b: number } => {
    let var_R = r / 255;
    let var_G = g / 255;
    let var_B = b / 255;

    const gammaCorrect = (x: number): number => {
        return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
    };
    var_R = gammaCorrect(var_R);
    var_G = gammaCorrect(var_G);
    var_B = gammaCorrect(var_B);

    const X = var_R * 0.4124564 + var_G * 0.3575761 + var_B * 0.1804375;
    const Y = var_R * 0.2126729 + var_G * 0.7151522 + var_B * 0.0721750;
    const Z = var_R * 0.0193349 + var_G * 0.1191920 + var_B * 0.9503041;

    const refX = 95.047;
    const refY = 100.000;
    const refZ = 108.883;

    let var_X = X / refX;
    let var_Y = Y / refY;
    let var_Z = Z / refZ;

    const f = (x: number): number => {
        return x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    };

    const fx = f(var_X);
    const fy = f(var_Y);
    const fz = f(var_Z);

    const L = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const bVal = 200 * (fy - fz);

    return { L: Math.round(L * 100) / 100, a: Math.round(a * 100) / 100, b: Math.round(bVal * 100) / 100 };
};

const ThumbnailContainer = styled(Box)(({ theme }) => ({
    cursor: 'pointer',
    borderRadius: '8px',
    padding: '8px',
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: theme.palette.action.hover,
    },
}));

const ChannelCanvas = styled('canvas')({
    width: '80px',
    height: '80px',
    display: 'block',
    margin: '0 auto',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
});

const ImageEditor: React.FC = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfoData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [grayBitData, setGrayBitData] = useState<Uint8Array | null>(null);
    const [showMask, setShowMask] = useState<boolean>(false);
    const [displayMode, setDisplayMode] = useState<'normal' | 'grayscale' | 'grayscale-alpha' | 'rgb' | 'rgba'>('normal');
    const [levelsDialogOpen, setLevelsDialogOpen] = useState<boolean>(false);

    const [baseImageData, setBaseImageData] = useState<ImageData | null>(null);
    const [originalLoadedImageData, setOriginalLoadedImageData] = useState<ImageData | null>(null);
    const [displayImageData, setDisplayImageData] = useState<ImageData | null>(null);
    const [displayScalePercent, setDisplayScalePercent] = useState<number>(100);
    const [displayScaleMethod, setDisplayScaleMethod] = useState<'bilinear' | 'nearest-neighbor'>('bilinear');
    const [convolutionModalOpen, setConvolutionModalOpen] = useState<boolean>(false);
    const isFirstScaleRef = useRef<boolean>(true);

    const [channels, setChannels] = useState<ChannelState>({
        red: true,
        green: true,
        blue: true,
        alpha: true,
    });

    const [eyedropperActive, setEyedropperActive] = useState<boolean>(false);
    const [colorInfo, setColorInfo] = useState<ColorInfo | null>(null);
    const [colorDialogOpen, setColorDialogOpen] = useState<boolean>(false);
    const [scaleModalOpen, setScaleModalOpen] = useState<boolean>(false);

    const [channelThumbnails, setChannelThumbnails] = useState<{
        grayscale: string | null;
        grayscaleAlpha: string | null;
        rgb: string | null;
        rgba: string | null;
    }>({
        grayscale: null,
        grayscaleAlpha: null,
        rgb: null,
        rgba: null,
    });

    const canvasRef = useRef<ImageCanvasRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const applyChannelsToImageData = useCallback((imageData: ImageData, channelState: ChannelState, mode: 'normal' | 'grayscale' | 'grayscale-alpha' | 'rgb' | 'rgba' = 'normal'): ImageData => {
        const width = imageData.width;
        const height = imageData.height;
        const srcPixels = imageData.data;
        const result = new ImageData(width, height);
        const dstPixels = result.data;

        let processedData: ImageData;

        switch (mode) {
            case 'grayscale':
                processedData = convertToGrayscale(imageData);
                break;
            case 'grayscale-alpha':
                processedData = convertToGrayscale(imageData);
                break;
            default:
                processedData = new ImageData(width, height);
                const tempPixels = processedData.data;
                for (let i = 0; i < width * height; i++) {
                    const idx = i * 4;
                    tempPixels[idx] = srcPixels[idx];
                    tempPixels[idx + 1] = srcPixels[idx + 1];
                    tempPixels[idx + 2] = srcPixels[idx + 2];
                    tempPixels[idx + 3] = srcPixels[idx + 3];
                }
        }

        const processedPixels = processedData.data;

        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            let r = processedPixels[idx];
            let g = processedPixels[idx + 1];
            let b = processedPixels[idx + 2];
            let a = processedPixels[idx + 3];

            if (!channelState.red) r = 0;
            if (!channelState.green) g = 0;
            if (!channelState.blue) b = 0;
            if (!channelState.alpha) a = 255;

            dstPixels[idx] = r;
            dstPixels[idx + 1] = g;
            dstPixels[idx + 2] = b;
            dstPixels[idx + 3] = a;
        }

        return result;
    }, []);

    const updateDisplayImage = useCallback(() => {
        if (!baseImageData) {
            setDisplayImageData(null);
            return;
        }

        let mode: 'normal' | 'grayscale' | 'grayscale-alpha' | 'rgb' | 'rgba' = 'normal';
        if (displayMode === 'grayscale') mode = 'grayscale';
        else if (displayMode === 'grayscale-alpha') mode = 'grayscale-alpha';
        else if (displayMode === 'rgb') mode = 'rgb';
        else if (displayMode === 'rgba') mode = 'rgba';

        const filteredImageData = applyChannelsToImageData(baseImageData, channels, mode);

        if (displayScalePercent !== 100) {
            const scaledWidth = Math.max(1, Math.round(baseImageData.width * (displayScalePercent / 100)));
            const scaledHeight = Math.max(1, Math.round(baseImageData.height * (displayScalePercent / 100)));
            const scaledImageData = scaleImage(filteredImageData, scaledWidth, scaledHeight, displayScaleMethod);
            setDisplayImageData(scaledImageData);
        } else {
            setDisplayImageData(filteredImageData);
        }
    }, [baseImageData, channels, displayScalePercent, displayScaleMethod, displayMode, applyChannelsToImageData]);

    const generateChannelThumbnails = useCallback((imageData: ImageData) => {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;

        const grayscaleCanvas = document.createElement('canvas');
        grayscaleCanvas.width = width;
        grayscaleCanvas.height = height;
        const grayscaleCtx = grayscaleCanvas.getContext('2d');
        if (grayscaleCtx) {
            const grayImageData = new ImageData(width, height);
            const grayPixels = grayImageData.data;
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const gray = Math.round(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
                grayPixels[idx] = gray;
                grayPixels[idx + 1] = gray;
                grayPixels[idx + 2] = gray;
                grayPixels[idx + 3] = 255;
            }
            grayscaleCtx.putImageData(grayImageData, 0, 0);
            setChannelThumbnails(prev => ({ ...prev, grayscale: grayscaleCanvas.toDataURL() }));
        }

        const grayscaleAlphaCanvas = document.createElement('canvas');
        grayscaleAlphaCanvas.width = width;
        grayscaleAlphaCanvas.height = height;
        const grayscaleAlphaCtx = grayscaleAlphaCanvas.getContext('2d');
        if (grayscaleAlphaCtx) {
            const grayAlphaImageData = new ImageData(width, height);
            const grayAlphaPixels = grayAlphaImageData.data;
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const gray = Math.round(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
                grayAlphaPixels[idx] = gray;
                grayAlphaPixels[idx + 1] = gray;
                grayAlphaPixels[idx + 2] = gray;
                grayAlphaPixels[idx + 3] = pixels[idx + 3];
            }
            grayscaleAlphaCtx.putImageData(grayAlphaImageData, 0, 0);
            setChannelThumbnails(prev => ({ ...prev, grayscaleAlpha: grayscaleAlphaCanvas.toDataURL() }));
        }

        const rgbCanvas = document.createElement('canvas');
        rgbCanvas.width = width;
        rgbCanvas.height = height;
        const rgbCtx = rgbCanvas.getContext('2d');
        if (rgbCtx) {
            const rgbImageData = new ImageData(width, height);
            const rgbPixels = rgbImageData.data;
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                rgbPixels[idx] = pixels[idx];
                rgbPixels[idx + 1] = pixels[idx + 1];
                rgbPixels[idx + 2] = pixels[idx + 2];
                rgbPixels[idx + 3] = 255;
            }
            rgbCtx.putImageData(rgbImageData, 0, 0);
            setChannelThumbnails(prev => ({ ...prev, rgb: rgbCanvas.toDataURL() }));
        }

        const rgbaCanvas = document.createElement('canvas');
        rgbaCanvas.width = width;
        rgbaCanvas.height = height;
        const rgbaCtx = rgbaCanvas.getContext('2d');
        if (rgbaCtx) {
            rgbaCtx.putImageData(imageData, 0, 0);
            setChannelThumbnails(prev => ({ ...prev, rgba: rgbaCanvas.toDataURL() }));
        }
    }, []);

    const handleApplyConvolution = useCallback((newImageData: ImageData) => {
        setBaseImageData(newImageData);
        generateChannelThumbnails(newImageData);
        setDisplayScalePercent(100);

        if (imageInfo) {
            setImageInfo({
                ...imageInfo,
                width: newImageData.width,
                height: newImageData.height,
            });
        }
    }, [imageInfo, generateChannelThumbnails]);

    const handleApplyLevels = useCallback((newImageData: ImageData) => {
        setBaseImageData(newImageData);
        generateChannelThumbnails(newImageData);
    }, [generateChannelThumbnails]);

    const handleApplyScale = useCallback((scaledImageData: ImageData, newScalePercent: number) => {
        setBaseImageData(scaledImageData);
        setDisplayScalePercent(100);
        generateChannelThumbnails(scaledImageData);

        if (imageInfo) {
            setImageInfo({
                ...imageInfo,
                width: scaledImageData.width,
                height: scaledImageData.height,
            });
        }
    }, [imageInfo, generateChannelThumbnails]);

    const handleScaleForDisplay = useCallback((_scaledImageData: ImageData, scalePercent: number) => {
        setDisplayScalePercent(scalePercent);
    }, []);

    useEffect(() => {
        updateDisplayImage();
    }, [updateDisplayImage]);

    const setNewImageData = useCallback((imageData: ImageData, fileInfo: Omit<ImageInfoData, 'width' | 'height'>) => {
        setBaseImageData(imageData);
        setOriginalLoadedImageData(imageData);
        setDisplayScalePercent(100);
        generateChannelThumbnails(imageData);

        setImageInfo({
            ...fileInfo,
            width: imageData.width,
            height: imageData.height,
        });
    }, [generateChannelThumbnails]);

    const handleCanvasClick = useCallback((_event: React.MouseEvent<HTMLCanvasElement>, x: number, y: number, color: { r: number; g: number; b: number; a: number }) => {
        if (!eyedropperActive || !displayImageData) return;

        if (baseImageData) {
            const scaleX = baseImageData.width / displayImageData.width;
            const scaleY = baseImageData.height / displayImageData.height;
            const origX = Math.floor(x * scaleX);
            const origY = Math.floor(y * scaleY);

            if (origX >= 0 && origX < baseImageData.width && origY >= 0 && origY < baseImageData.height) {
                const idx = (origY * baseImageData.width + origX) * 4;
                const pixels = baseImageData.data;
                const lab = rgbToLab(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
                setColorInfo({
                    x: origX,
                    y: origY,
                    r: pixels[idx],
                    g: pixels[idx + 1],
                    b: pixels[idx + 2],
                    a: pixels[idx + 3],
                    lab
                });
                setColorDialogOpen(true);
            }
        }
    }, [eyedropperActive, displayImageData, baseImageData]);

    const readGrayBitFile = async (arrayBuffer: ArrayBuffer): Promise<{ imageData: ImageData; header: GrayBitHeader }> => {
        const data = new Uint8Array(arrayBuffer);

        const signature = data.slice(0, 4);
        const expectedSignature = new Uint8Array([0x47, 0x42, 0x37, 0x1D]);

        for (let i = 0; i < 4; i++) {
            if (signature[i] !== expectedSignature[i]) {
                throw new Error('Неверный формат GrayBit-7 файла');
            }
        }

        const version = data[4];
        const flags = data[5];
        const width = (data[6] << 8) | data[7];
        const height = (data[8] << 8) | data[9];
        const reserved = (data[10] << 8) | data[11];
        const hasMask = (flags & 0x01) === 1;

        if (version !== 0x01) {
            throw new Error(`Неподдерживаемая версия GrayBit: ${version}`);
        }

        const pixelData = data.slice(12);
        const expectedSize = width * height;

        if (pixelData.length < expectedSize) {
            throw new Error('Недостаточно данных в файле');
        }

        const imageData = new ImageData(width, height);

        for (let i = 0; i < expectedSize; i++) {
            const pixel = pixelData[i];
            const grayValue = pixel & 0x7F;
            const maskBit = (pixel >> 7) & 0x01;
            const rgbValue = Math.round((grayValue / 127) * 255);
            const alpha = (hasMask && maskBit === 0) ? 0 : 255;

            imageData.data[i * 4] = rgbValue;
            imageData.data[i * 4 + 1] = rgbValue;
            imageData.data[i * 4 + 2] = rgbValue;
            imageData.data[i * 4 + 3] = alpha;
        }

        return {
            imageData,
            header: {
                signature,
                version,
                flags,
                width,
                height,
                reserved,
                hasMask,
            },
        };
    };

    const convertToGrayBit = (imageData: ImageData, includeMask: boolean = false): Uint8Array => {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;
        const grayBitBuffer = new Uint8Array(width * height);

        for (let i = 0; i < width * height; i++) {
            const r = pixels[i * 4];
            const g = pixels[i * 4 + 1];
            const b = pixels[i * 4 + 2];
            const a = pixels[i * 4 + 3];

            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            const gray7Bit = Math.round((gray / 255) * 127);
            const maskBit = includeMask ? (a > 128 ? 1 : 0) : 0;

            grayBitBuffer[i] = (maskBit << 7) | (gray7Bit & 0x7F);
        }

        return grayBitBuffer;
    };

    const createGrayBitFile = (imageData: ImageData, includeMask: boolean = false): Uint8Array => {
        const width = imageData.width;
        const height = imageData.height;
        const grayBitData = convertToGrayBit(imageData, includeMask);

        const header = new Uint8Array(12);
        header[0] = 0x47; header[1] = 0x42; header[2] = 0x37; header[3] = 0x1D;
        header[4] = 0x01;
        header[5] = includeMask ? 0x01 : 0x00;
        header[6] = (width >> 8) & 0xFF;
        header[7] = width & 0xFF;
        header[8] = (height >> 8) & 0xFF;
        header[9] = height & 0xFF;
        header[10] = 0x00;
        header[11] = 0x00;

        const result = new Uint8Array(header.length + grayBitData.length);
        result.set(header);
        result.set(grayBitData, header.length);

        return result;
    };

    const handleGrayBitUpload = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const { imageData, header } = await readGrayBitFile(arrayBuffer);

            setNewImageData(imageData, {
                colorDepth: header.hasMask ? 8 : 7,
                fileSize: file.size,
                fileName: file.name,
                fileType: 'image/graybit-7',
                hasMask: header.hasMask,
            });

            setSelectedImage(URL.createObjectURL(file));
            setGrayBitData(new Uint8Array(arrayBuffer));
            setLoading(false);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка при загрузке GrayBit-7 файла');
            setLoading(false);
        }
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.gb7') || file.name.endsWith('.graybit')) {
            setLoading(true);
            handleGrayBitUpload(file);
            return;
        }

        if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
            setError('Пожалуйста, загрузите файл в формате PNG, JPG/JPEG или GrayBit-7 (.gb7)');
            return;
        }

        setLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, img.width, img.height);

                    setNewImageData(data, {
                        colorDepth: 24,
                        fileSize: file.size,
                        fileName: file.name,
                        fileType: file.type,
                        hasMask: false,
                    });

                    setSelectedImage(e.target?.result as string);
                    setGrayBitData(null);
                }
                setLoading(false);
            };
            img.onerror = () => {
                setError('Ошибка при загрузке изображения');
                setLoading(false);
            };
            img.src = e.target?.result as string;
        };
        reader.onerror = () => {
            setError('Ошибка при чтении файла');
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const setGrayscaleMode = useCallback(() => {
        setDisplayMode('grayscale');
        setChannels({ red: true, green: true, blue: true, alpha: false });
    }, []);

    const setGrayscaleAlphaMode = useCallback(() => {
        setDisplayMode('grayscale-alpha');
        setChannels({ red: true, green: true, blue: true, alpha: true });
    }, []);

    const setRGBMode = useCallback(() => {
        setDisplayMode('rgb');
        setChannels({ red: true, green: true, blue: true, alpha: false });
    }, []);

    const setRGBAMode = useCallback(() => {
        setDisplayMode('rgba');
        setChannels({ red: true, green: true, blue: true, alpha: true });
    }, []);

    const resetChannels = useCallback(() => {
        setDisplayMode('normal');
        setChannels({ red: true, green: true, blue: true, alpha: true });
    }, []);

    const handleDownloadGrayBit = (includeMask: boolean = false) => {
        if (!baseImageData) return;

        try {
            const grayBitFile = createGrayBitFile(baseImageData, includeMask);
            const blob = new Blob([grayBitFile], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().getTime();
            link.download = `image_${timestamp}.gb7`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setError('Ошибка при сохранении в GrayBit-7 формате');
        }
    };

    const handleDownload = (format: 'png' | 'jpg') => {
        if (!displayImageData) return;

        const canvas = document.createElement('canvas');
        canvas.width = displayImageData.width;
        canvas.height = displayImageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.putImageData(displayImageData, 0, 0);

            try {
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                const quality = format === 'jpg' ? 0.92 : undefined;
                const dataURL = canvas.toDataURL(mimeType, quality);
                const link = document.createElement('a');
                const timestamp = new Date().getTime();
                link.download = `image_${timestamp}.${format}`;
                link.href = dataURL;
                link.click();
            } catch (error) {
                setError('Ошибка при скачивании изображения');
            }
        }
    };

    const handleClear = () => {
        setSelectedImage(null);
        setImageInfo(null);
        setError(null);
        setGrayBitData(null);
        setBaseImageData(null);
        setOriginalLoadedImageData(null);
        setDisplayImageData(null);
        setDisplayScalePercent(100);
        setEyedropperActive(false);
        setColorInfo(null);
        setChannelThumbnails({ grayscale: null, grayscaleAlpha: null, rgb: null, rgba: null });
        setChannels({ red: true, green: true, blue: true, alpha: true });
        setDisplayMode('normal');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        const handleOpenScaleModal = () => setScaleModalOpen(true);
        window.addEventListener('openScaleModal', handleOpenScaleModal);
        return () => window.removeEventListener('openScaleModal', handleOpenScaleModal);
    }, []);

    return (
        <Box ref={containerRef}>
            {baseImageData && (
                <ScaleControl
                    originalImageData={baseImageData}
                    onScaledImageChange={handleScaleForDisplay}
                    containerRef={containerRef}
                    onOpenScaleModal={() => setScaleModalOpen(true)}
                    externalScale={displayScalePercent}
                    onScaleChange={(newScale) => setDisplayScalePercent(newScale)}
                />
            )}

            <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Управление
                        </Typography>

                        <Box sx={{ mb: 3 }}>
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, .gb7, .graybit"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                                id="image-upload"
                            />
                            <label htmlFor="image-upload">
                                <Button
                                    variant="contained"
                                    component="span"
                                    fullWidth
                                    startIcon={<UploadIcon />}
                                    sx={{ mb: 2 }}
                                >
                                    Загрузить изображение
                                </Button>
                            </label>

                            {selectedImage && (
                                <>
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                                        Сохранить как:
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleDownload('png')}
                                        sx={{ mb: 1 }}
                                    >
                                        PNG
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleDownload('jpg')}
                                        sx={{ mb: 1 }}
                                    >
                                        JPG
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<SaveIcon />}
                                        onClick={() => handleDownloadGrayBit(false)}
                                        sx={{ mb: 1 }}
                                        color="secondary"
                                    >
                                        GrayBit-7
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<SaveIcon />}
                                        onClick={() => handleDownloadGrayBit(true)}
                                        sx={{ mb: 2 }}
                                        color="secondary"
                                    >
                                        GrayBit-7 (с маской)
                                    </Button>
                                    <Button
                                        variant="text"
                                        color="error"
                                        fullWidth
                                        startIcon={<DeleteIcon />}
                                        onClick={handleClear}
                                    >
                                        Очистить
                                    </Button>
                                </>
                            )}
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>
                            Инструменты:
                        </Typography>
                        <Tooltip title="Кликните на изображение, чтобы получить цвет пикселя">
                            <Button
                                variant={eyedropperActive ? "contained" : "outlined"}
                                color={eyedropperActive ? "secondary" : "primary"}
                                fullWidth
                                startIcon={<ColorLensIcon />}
                                onClick={() => setEyedropperActive(!eyedropperActive)}
                                sx={{ mb: 2 }}
                            >
                                Пипетка {eyedropperActive && "(активна)"}
                            </Button>
                        </Tooltip>
                        <Tooltip title="Свертка изображения (Custom Filter)">
                            <Button
                                variant="outlined"
                                color="primary"
                                fullWidth
                                startIcon={<KernelIcon />}
                                onClick={() => setConvolutionModalOpen(true)}
                                sx={{ mb: 2 }}
                                disabled={!baseImageData}
                            >
                                Фильтр (Convolution)
                            </Button>
                        </Tooltip>
                        <Tooltip title="Коррекция уровней (Levels)">
                            <Button
                                variant="outlined"
                                color="primary"
                                fullWidth
                                startIcon={<LevelsIcon />}
                                onClick={() => setLevelsDialogOpen(true)}
                                sx={{ mb: 2 }}
                                disabled={!baseImageData}
                            >
                                Уровни (Levels)
                            </Button>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Инструкция:</strong>
                            <br />
                            1. Загрузите изображение
                            <br />
                            2. Используйте слайдер масштаба для изменения отображения
                            <br />
                            3. Управляйте каналами на панели справа
                            <br />
                            4. Включите пипетку и кликните на изображение
                            <br />
                            5. Сохраните в нужном формате
                            <br />
                            <br />
                            <strong>CIELAB:</strong> L* (светлота), a* (зеленый-красный), b* (синий-желтый)
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Просмотр изображения
                        </Typography>

                        <ImageCanvas
                            ref={canvasRef}
                            imageData={displayImageData}
                            isLoading={loading}
                            onClick={handleCanvasClick}
                            cursor={eyedropperActive ? 'crosshair' : 'default'}
                        />

                        {colorInfo && (
                            <Alert severity="info" sx={{ mt: 2 }} onClose={() => setColorInfo(null)}>
                                <Typography variant="body2">
                                    Пиксель ({colorInfo.x}, {colorInfo.y}):
                                    RGB({colorInfo.r}, {colorInfo.g}, {colorInfo.b})
                                    {' | '}
                                    CIELAB(L*={colorInfo.lab.L}, a*={colorInfo.lab.a}, b*={colorInfo.lab.b})
                                </Typography>
                            </Alert>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Цветовые каналы
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Кликните на миниатюру, чтобы применить пресет каналов
                        </Typography>

                        <ThumbnailContainer onClick={setGrayscaleMode}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                1. Grayscale (только яркость)
                            </Typography>
                            {channelThumbnails.grayscale ? (
                                <img src={channelThumbnails.grayscale} alt="Grayscale" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>

                        <ThumbnailContainer onClick={setGrayscaleAlphaMode}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                2. Grayscale + Alpha (с прозрачностью)
                            </Typography>
                            {channelThumbnails.grayscaleAlpha ? (
                                <img src={channelThumbnails.grayscaleAlpha} alt="Grayscale + Alpha" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>

                        <ThumbnailContainer onClick={setRGBMode}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                3. RGB (без альфа-канала)
                            </Typography>
                            {channelThumbnails.rgb ? (
                                <img src={channelThumbnails.rgb} alt="RGB" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>

                        <ThumbnailContainer onClick={setRGBAMode}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                4. RGBA (все каналы)
                            </Typography>
                            {channelThumbnails.rgba ? (
                                <img src={channelThumbnails.rgba} alt="RGBA" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>
                            Отдельные каналы (чекбоксы):
                        </Typography>

                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                            <Chip
                                label="R (Красный)"
                                onClick={() => setChannels(prev => ({ ...prev, red: !prev.red }))}
                                color={channels.red ? "error" : "default"}
                                variant={channels.red ? "filled" : "outlined"}
                            />
                            <Chip
                                label="G (Зеленый)"
                                onClick={() => setChannels(prev => ({ ...prev, green: !prev.green }))}
                                color={channels.green ? "success" : "default"}
                                variant={channels.green ? "filled" : "outlined"}
                            />
                            <Chip
                                label="B (Синий)"
                                onClick={() => setChannels(prev => ({ ...prev, blue: !prev.blue }))}
                                color={channels.blue ? "primary" : "default"}
                                variant={channels.blue ? "filled" : "outlined"}
                            />
                            <Chip
                                label="A (Альфа)"
                                onClick={() => setChannels(prev => ({ ...prev, alpha: !prev.alpha }))}
                                color={channels.alpha ? "secondary" : "default"}
                                variant={channels.alpha ? "filled" : "outlined"}
                                icon={<OpacityIcon />}
                            />
                        </Stack>

                        <Button
                            variant="text"
                            size="small"
                            fullWidth
                            onClick={resetChannels}
                            sx={{ mt: 1 }}
                        >
                            Сбросить все каналы (включить всё)
                        </Button>
                    </Paper>
                </Grid>
            </Grid>

            {imageInfo && (
                <ImageInfo
                    fileName={imageInfo.fileName}
                    fileSize={imageInfo.fileSize}
                    width={baseImageData?.width || imageInfo.width}
                    height={baseImageData?.height || imageInfo.height}
                    colorDepth={imageInfo.colorDepth}
                    visibleChannels={channels}
                />
            )}

            {imageInfo && <Box sx={{ mb: 8 }} />}

            <LevelsDialog
                open={levelsDialogOpen}
                onClose={(apply) => {
                    setLevelsDialogOpen(false);
                }}
                originalImageData={baseImageData}
                currentImageData={baseImageData}
                onApplyLevels={handleApplyLevels}
            />

            <ScaleModal
                open={scaleModalOpen}
                onClose={() => setScaleModalOpen(false)}
                originalImageData={baseImageData}
                onApplyScale={handleApplyScale}
                currentScalePercent={100}
            />
            <ConvolutionModal
                open={convolutionModalOpen}
                onClose={() => setConvolutionModalOpen(false)}
                originalImageData={baseImageData}
                onApply={handleApplyConvolution}
            />

        </Box>
    );
};

export default ImageEditor;