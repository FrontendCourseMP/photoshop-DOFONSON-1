// components/ImageEditor.tsx
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
    FormControlLabel,
    Switch,
    IconButton,
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
} from '@mui/icons-material';

interface ImageInfo {
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

// Конвертация RGB в CIELAB
const rgbToLab = (r: number, g: number, b: number): { L: number; a: number; b: number } => {
    // Нормализуем RGB в диапазон [0, 1]
    let var_R = r / 255;
    let var_G = g / 255;
    let var_B = b / 255;

    // Применяем гамма-коррекцию
    const gammaCorrect = (x: number): number => {
        return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
    };
    var_R = gammaCorrect(var_R);
    var_G = gammaCorrect(var_G);
    var_B = gammaCorrect(var_B);

    // Конвертируем в XYZ
    const X = var_R * 0.4124564 + var_G * 0.3575761 + var_B * 0.1804375;
    const Y = var_R * 0.2126729 + var_G * 0.7151522 + var_B * 0.0721750;
    const Z = var_R * 0.0193339 + var_G * 0.1191920 + var_B * 0.9503041;

    // Референсные белые точки (D65)
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

// Миниатюра канала
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
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [grayBitData, setGrayBitData] = useState<Uint8Array | null>(null);
    const [showMask, setShowMask] = useState<boolean>(false);
    
    // Оригинальные данные изображения (неизменяемые)
    const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
    
    // Состояние каналов
    const [channels, setChannels] = useState<ChannelState>({
        red: true,
        green: true,
        blue: true,
        alpha: true,
    });
    
    // Состояние инструмента пипетки
    const [eyedropperActive, setEyedropperActive] = useState<boolean>(false);
    const [colorInfo, setColorInfo] = useState<ColorInfo | null>(null);
    const [colorDialogOpen, setColorDialogOpen] = useState<boolean>(false);
    
    // Миниатюры каналов
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
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Применение фильтра каналов к изображению
    const applyChannelFilter = useCallback(() => {
        if (!originalImageData || !canvasRef.current) return;

        const width = originalImageData.width;
        const height = originalImageData.height;
        const originalPixels = originalImageData.data;
        
        // Создаем новый ImageData для вывода
        const outputImageData = new ImageData(width, height);
        const outputPixels = outputImageData.data;
        
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            let r = originalPixels[idx];
            let g = originalPixels[idx + 1];
            let b = originalPixels[idx + 2];
            let a = originalPixels[idx + 3];
            
            // Применяем состояние каналов
            if (!channels.red) r = 0;
            if (!channels.green) g = 0;
            if (!channels.blue) b = 0;
            if (!channels.alpha) a = 255; // Если альфа выключен, делаем непрозрачным
            
            outputPixels[idx] = r;
            outputPixels[idx + 1] = g;
            outputPixels[idx + 2] = b;
            outputPixels[idx + 3] = a;
        }
        
        // Отрисовка на canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            ctx.putImageData(outputImageData, 0, 0);
        }
    }, [originalImageData, channels]);

    // Генерация миниатюр для панели каналов
    const generateChannelThumbnails = useCallback((imageData: ImageData) => {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;
        
        // 1. Grayscale (только яркость)
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
        
        // 2. Grayscale + Alpha (яркость + альфа-канал)
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
        
        // 3. RGB (цветное)
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
        
        // 4. RGB + Alpha (цветное с прозрачностью)
        const rgbaCanvas = document.createElement('canvas');
        rgbaCanvas.width = width;
        rgbaCanvas.height = height;
        const rgbaCtx = rgbaCanvas.getContext('2d');
        if (rgbaCtx) {
            rgbaCtx.putImageData(imageData, 0, 0);
            setChannelThumbnails(prev => ({ ...prev, rgba: rgbaCanvas.toDataURL() }));
        }
    }, []);

    // Обработчик клика на холсте для пипетки
    const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!eyedropperActive || !originalImageData || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        const x = Math.floor(Math.min(Math.max(mouseX, 0), canvas.width - 1));
        const y = Math.floor(Math.min(Math.max(mouseY, 0), canvas.height - 1));
        
        const idx = (y * canvas.width + x) * 4;
        const pixels = originalImageData.data;
        
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];
        
        const lab = rgbToLab(r, g, b);
        
        setColorInfo({ x, y, r, g, b, a, lab });
        setColorDialogOpen(true);
    }, [eyedropperActive, originalImageData]);

    // Чтение GrayBit-7 файла
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
    
    // Конвертация в GrayBit-7
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
            
            setOriginalImageData(imageData);
            generateChannelThumbnails(imageData);
            
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.putImageData(imageData, 0, 0);
            }
            
            setImageInfo({
                width: imageData.width,
                height: imageData.height,
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
                const canvas = canvasRef.current;
                if (!canvas) {
                    setLoading(false);
                    return;
                }
                
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    setLoading(false);
                    return;
                }
                
                ctx.drawImage(img, 0, 0, img.width, img.height);
                
                // Сохраняем оригинальные данные
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                setOriginalImageData(imageData);
                generateChannelThumbnails(imageData);
                
                setImageInfo({
                    width: img.width,
                    height: img.height,
                    colorDepth: 24,
                    fileSize: file.size,
                    fileName: file.name,
                    fileType: file.type,
                    hasMask: false,
                });
                
                setSelectedImage(e.target?.result as string);
                setGrayBitData(null);
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
    
    // Сброс состояния каналов (показать всё)
    const resetChannels = () => {
        setChannels({ red: true, green: true, blue: true, alpha: true });
    };
    
    const handleDownloadGrayBit = (includeMask: boolean = false) => {
        if (!originalImageData) return;
        
        try {
            const grayBitFile = createGrayBitFile(originalImageData, includeMask);
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
        const canvas = canvasRef.current;
        if (!canvas) return;
        
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
    };
    
    const handleClear = () => {
        setSelectedImage(null);
        setImageInfo(null);
        setError(null);
        setGrayBitData(null);
        setOriginalImageData(null);
        setEyedropperActive(false);
        setColorInfo(null);
        setChannelThumbnails({ grayscale: null, grayscaleAlpha: null, rgb: null, rgba: null });
        setChannels({ red: true, green: true, blue: true, alpha: true });
        
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                canvasRef.current.width = 0;
                canvasRef.current.height = 0;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    // Применяем фильтр каналов при изменении состояния каналов или оригинальных данных
    useEffect(() => {
        if (originalImageData) {
            applyChannelFilter();
        }
    }, [originalImageData, channels, applyChannelFilter]);
    
    // Обновляем состояние маски для отображения
    useEffect(() => {
        if (showMask && originalImageData) {
            setChannels(prev => ({ ...prev, red: false, green: false, blue: false, alpha: true }));
        }
    }, [showMask]);
    
    return (
        <Box>
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                <Typography variant="h4" align="center" gutterBottom>
                    Редактор изображений
                </Typography>
                <Typography variant="subtitle1" align="center">
                    Поддерживает PNG, JPG и GrayBit-7 (.gb7) форматы | Цветовые каналы | Пипетка | CIELAB
                </Typography>
            </Paper>
            
            <Grid container spacing={3}>
                {/* Левая панель - управление */}
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
                        
                        {imageInfo?.hasMask && (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={showMask}
                                        onChange={(e) => setShowMask(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Показать только маску"
                                sx={{ mt: 2 }}
                            />
                        )}
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Инструкция:</strong>
                            <br />
                            1. Загрузите изображение
                            <br />
                            2. Управляйте каналами на панели справа
                            <br />
                            3. Включите пипетку и кликните на изображение
                            <br />
                            4. Сохраните в нужном формате
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
                
                {/* Центральная панель - холст */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Просмотр изображения
                        </Typography>
                        
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                minHeight: 400,
                                bgcolor: '#f5f5f5',
                                borderRadius: 1,
                                position: 'relative',
                                border: '1px solid #e0e0e0',
                            }}
                        >
                            {loading && (
                                <Box sx={{ textAlign: 'center' }}>
                                    <CircularProgress />
                                    <Typography sx={{ mt: 2 }}>Загрузка изображения...</Typography>
                                </Box>
                            )}
                            
                            {!loading && !selectedImage && (
                                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                                    <ImageIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                                    <Typography>Изображение не загружено</Typography>
                                </Box>
                            )}
                            
                            <canvas
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                style={{
                                    maxWidth: '100%',
                                    height: 'auto',
                                    display: selectedImage ? 'block' : 'none',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    cursor: eyedropperActive ? 'crosshair' : 'default',
                                }}
                            />
                        </Box>
                        
                        {/* Информация о цвете */}
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
                
                {/* Правая панель - каналы */}
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Цветовые каналы
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Кликните на миниатюру, чтобы включить/выключить канал
                        </Typography>
                        
                        {/* Grayscale */}
                        <ThumbnailContainer onClick={() => setChannels({ red: true, green: true, blue: true, alpha: false })}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                1. Grayscale
                            </Typography>
                            {channelThumbnails.grayscale ? (
                                <img src={channelThumbnails.grayscale} alt="Grayscale" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>
                        
                        {/* Grayscale + Alpha */}
                        <ThumbnailContainer onClick={() => setChannels({ red: true, green: true, blue: true, alpha: true })}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                2. Grayscale + Alpha
                            </Typography>
                            {channelThumbnails.grayscaleAlpha ? (
                                <img src={channelThumbnails.grayscaleAlpha} alt="Grayscale + Alpha" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>
                        
                        {/* RGB */}
                        <ThumbnailContainer onClick={() => setChannels({ red: true, green: true, blue: true, alpha: false })}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                3. RGB
                            </Typography>
                            {channelThumbnails.rgb ? (
                                <img src={channelThumbnails.rgb} alt="RGB" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>
                        
                        {/* RGB + Alpha */}
                        <ThumbnailContainer onClick={() => setChannels({ red: true, green: true, blue: true, alpha: true })}>
                            <Typography variant="caption" gutterBottom display="block" align="center">
                                4. RGB + Alpha
                            </Typography>
                            {channelThumbnails.rgba ? (
                                <img src={channelThumbnails.rgba} alt="RGBA" style={{ width: '80px', height: '80px', margin: '0 auto', display: 'block', borderRadius: '4px' }} />
                            ) : (
                                <ChannelCanvas width={80} height={80} />
                            )}
                        </ThumbnailContainer>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="subtitle2" gutterBottom>
                            Отдельные каналы:
                        </Typography>
                        
                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                            <Chip
                                label="R"
                                onClick={() => setChannels(prev => ({ ...prev, red: !prev.red }))}
                                color={channels.red ? "error" : "default"}
                                variant={channels.red ? "filled" : "outlined"}
                            />
                            <Chip
                                label="G"
                                onClick={() => setChannels(prev => ({ ...prev, green: !prev.green }))}
                                color={channels.green ? "success" : "default"}
                                variant={channels.green ? "filled" : "outlined"}
                            />
                            <Chip
                                label="B"
                                onClick={() => setChannels(prev => ({ ...prev, blue: !prev.blue }))}
                                color={channels.blue ? "primary" : "default"}
                                variant={channels.blue ? "filled" : "outlined"}
                            />
                            <Chip
                                label="A"
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
                            Сбросить все каналы
                        </Button>
                    </Paper>
                </Grid>
            </Grid>
            
            {/* Информационная панель внизу */}
            {imageInfo && (
                <Paper
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        bgcolor: '#263238',
                        color: 'white',
                        zIndex: 1000,
                        borderRadius: 0,
                    }}
                >
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <InfoIcon fontSize="small" />
                                <Typography variant="body2">
                                    <strong>Файл:</strong> {imageInfo.fileName}
                                </Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={6} sm={3} md={2}>
                            <Typography variant="body2">
                                <strong>Размер:</strong> {formatFileSize(imageInfo.fileSize)}
                            </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3} md={2}>
                            <Typography variant="body2">
                                <strong>Ширина:</strong> {imageInfo.width} px
                            </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3} md={2}>
                            <Typography variant="body2">
                                <strong>Высота:</strong> {imageInfo.height} px
                            </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3} md={3}>
                            <Typography variant="body2">
                                <strong>Каналы:</strong>{' '}
                                {channels.red && 'R '}
                                {channels.green && 'G '}
                                {channels.blue && 'B '}
                                {channels.alpha && 'A'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            )}
            
            {/* Диалог с детальной информацией о цвете */}
            <Dialog open={colorDialogOpen} onClose={() => setColorDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ColorLensIcon color="primary" />
                        <Typography>Информация о цвете пикселя</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    {colorInfo && (
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <TableCell variant="head"><strong>Координаты</strong></TableCell>
                                    <TableCell>X = {colorInfo.x}, Y = {colorInfo.y}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell variant="head"><strong>RGB</strong></TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    backgroundColor: `rgba(${colorInfo.r}, ${colorInfo.g}, ${colorInfo.b}, ${colorInfo.a / 255})`,
                                                    border: '1px solid #ccc',
                                                    borderRadius: 1,
                                                }}
                                            />
                                            <span>R: {colorInfo.r}, G: {colorInfo.g}, B: {colorInfo.b}</span>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell variant="head"><strong>Прозрачность (Alpha)</strong></TableCell>
                                    <TableCell>{Math.round((colorInfo.a / 255) * 100)}% ({colorInfo.a})</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell variant="head"><strong>CIELAB</strong></TableCell>
                                    <TableCell>
                                        L*: {colorInfo.lab.L}<br />
                                        a*: {colorInfo.lab.a}<br />
                                        b*: {colorInfo.lab.b}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </DialogContent>
            </Dialog>
            
            {imageInfo && <Box sx={{ mb: 8 }} />}
        </Box>
    );
};

export default ImageEditor;