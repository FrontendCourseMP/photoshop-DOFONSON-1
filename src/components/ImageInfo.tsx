import React from 'react';
import { Paper, Grid, Typography, Stack, Chip, Box } from '@mui/material';
import {
    Info as InfoIcon,
    Image as ImageIcon,
    Straighten as SizeIcon,
    Palette as ColorIcon,
    Memory as MemoryIcon,
} from '@mui/icons-material';

interface ImageInfoProps {
    fileName: string;
    fileSize: number;
    width: number;
    height: number;
    colorDepth: number;
    visibleChannels?: { red: boolean; green: boolean; blue: boolean; alpha: boolean };
}

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ImageInfo: React.FC<ImageInfoProps> = ({
    fileName,
    fileSize,
    width,
    height,
    colorDepth,
    visibleChannels,
}) => {
    const megapixels = (width * height / 1000000).toFixed(2);

    return (
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
                        <Typography variant="body2" noWrap>
                            <strong>Файл:</strong> {fileName}
                        </Typography>
                    </Stack>
                </Grid>

                <Grid item xs={6} sm={3} md={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <MemoryIcon fontSize="small" />
                        <Typography variant="body2">
                            <strong>Размер:</strong> {formatFileSize(fileSize)}
                        </Typography>
                    </Stack>
                </Grid>

                <Grid item xs={6} sm={3} md={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <SizeIcon fontSize="small" />
                        <Typography variant="body2">
                            <strong>Размеры:</strong> {width}×{height}
                        </Typography>
                    </Stack>
                </Grid>

                <Grid item xs={6} sm={3} md={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <ImageIcon fontSize="small" />
                        <Typography variant="body2">
                            <strong>Мп:</strong> {megapixels}
                        </Typography>
                    </Stack>
                </Grid>

                <Grid item xs={6} sm={3} md={3}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <ColorIcon fontSize="small" />
                        <Typography variant="body2">
                            <strong>Глубина цвета:</strong>{' '}
                            {colorDepth === 32 && '32-bit (RGBA)'}
                            {colorDepth === 24 && '24-bit (RGB)'}
                            {colorDepth === 8 && '8-bit (Grayscale + Mask)'}
                            {colorDepth === 7 && '7-bit (Grayscale)'}
                            {(!colorDepth || colorDepth === 0) && 'Неизвестно'}
                        </Typography>
                    </Stack>
                </Grid>

                <Grid item xs={12} sm={3} md={3}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <ColorIcon fontSize="small" />
                        <Typography variant="body2">
                            <strong>Каналы:</strong>{' '}
                            {visibleChannels ? (
                                <>
                                    {visibleChannels.red && <Chip label="R" size="small" sx={{ height: 20, mr: 0.5, bgcolor: '#f44336', color: 'white' }} />}
                                    {visibleChannels.green && <Chip label="G" size="small" sx={{ height: 20, mr: 0.5, bgcolor: '#4caf50', color: 'white' }} />}
                                    {visibleChannels.blue && <Chip label="B" size="small" sx={{ height: 20, mr: 0.5, bgcolor: '#2196f3', color: 'white' }} />}
                                    {visibleChannels.alpha && <Chip label="A" size="small" sx={{ height: 20, bgcolor: '#9c27b0', color: 'white' }} />}
                                </>
                            ) : (
                                `${colorDepth}-bit`
                            )}
                        </Typography>
                    </Stack>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ImageInfo;