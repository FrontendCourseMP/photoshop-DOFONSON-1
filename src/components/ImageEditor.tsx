import React, { useState, useRef, ChangeEvent } from 'react';
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
} from '@mui/material';
import {
    Upload as UploadIcon,
    Download as DownloadIcon,
    Image as ImageIcon,
    Info as InfoIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';

interface ImageInfo {
    width: number;
    height: number;
    colorDepth: number;
    fileSize: number;
    fileName: string;
    fileType: string;
}

const ImageEditor: React.FC = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getColorDepth = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        let hasAlpha = false;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
                hasAlpha = true;
                break;
            }
        }

        return hasAlpha ? 32 : 24;
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
            setError('Пожалуйста, загрузите файл в формате PNG или JPG/JPEG');
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

                const colorDepth = getColorDepth(ctx, img.width, img.height);

                setImageInfo({
                    width: img.width,
                    height: img.height,
                    colorDepth: colorDepth,
                    fileSize: file.size,
                    fileName: file.name,
                    fileType: file.type,
                });

                setSelectedImage(e.target?.result as string);
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

    const handleDownload = (format: 'png' | 'jpg') => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const quality = format === 'jpg' ? 0.92 : undefined;

            const dataURL = canvas.toDataURL(mimeType, quality);
            const link = document.createElement('a');

            const timestamp = new Date().getTime();
            const filename = `image_${timestamp}.${format}`;

            link.download = filename;
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

    return (
        <Box>
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                <Typography variant="h4" align="center" gutterBottom>
                    Редактор изображений
                </Typography>
                <Typography variant="subtitle1" align="center">
                    Загружайте, просматривайте и сохраняйте изображения в форматах PNG и JPG
                </Typography>
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Управление
                        </Typography>

                        <Box sx={{ mb: 3 }}>
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/jpg"
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
                                        PNG (с прозрачностью)
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleDownload('jpg')}
                                        sx={{ mb: 2 }}
                                    >
                                        JPG (без прозрачности)
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
                            Поддерживаемые форматы:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <Chip label="PNG" size="small" color="primary" />
                            <Chip label="JPG" size="small" color="primary" />
                            <Chip label="JPEG" size="small" color="primary" />
                        </Stack>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            <strong>Инструкция:</strong>
                            <br />
                            1. Нажмите "Загрузить изображение"
                            <br />
                            2. Выберите PNG или JPG файл
                            <br />
                            3. Изображение отобразится на canvas
                            <br />
                            4. Сохраните в нужном формате
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
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
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        Нажмите "Загрузить изображение" чтобы начать
                                    </Typography>
                                </Box>
                            )}

                            <canvas
                                ref={canvasRef}
                                style={{
                                    maxWidth: '100%',
                                    height: 'auto',
                                    display: selectedImage ? 'block' : 'none',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                }}
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

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
                                <strong>Глубина цвета:</strong> {imageInfo.colorDepth}-bit
                                {imageInfo.colorDepth === 32 && ' (RGBA - с прозрачностью)'}
                                {imageInfo.colorDepth === 24 && ' (RGB - без прозрачности)'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {imageInfo && <Box sx={{ mb: 8 }} />}
        </Box>
    );
};

export default ImageEditor;
