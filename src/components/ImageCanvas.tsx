import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';

interface ImageCanvasProps {
    imageData: ImageData | null;
    isLoading?: boolean;
    onClick?: (event: React.MouseEvent<HTMLCanvasElement>, x: number, y: number, color: { r: number; g: number; b: number; a: number }) => void;
    cursor?: string;
}

export interface ImageCanvasRef {
    getCanvas: () => HTMLCanvasElement | null;
    getContext: () => CanvasRenderingContext2D | null;
}

const ImageCanvas = forwardRef<ImageCanvasRef, ImageCanvasProps>(({
    imageData,
    isLoading = false,
    onClick,
    cursor = 'default',
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useImperativeHandle(ref, () => ({
        getCanvas: () => canvasRef.current,
        getContext: () => canvasRef.current?.getContext('2d') || null,
    }));
    
    useEffect(() => {
        if (imageData && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                ctx.putImageData(imageData, 0, 0);
            }
        }
    }, [imageData]);
    
    const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onClick || !imageData || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);
        
        if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
            const idx = (y * imageData.width + x) * 4;
            const pixels = imageData.data;
            
            onClick(event, x, y, {
                r: pixels[idx],
                g: pixels[idx + 1],
                b: pixels[idx + 2],
                a: pixels[idx + 3],
            });
        }
    };
    
    return (
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
                overflow: 'auto',
            }}
        >
            {isLoading && (
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Обработка изображения...</Typography>
                </Box>
            )}
            
            {!isLoading && !imageData && (
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <ImageIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                    <Typography>Изображение не загружено</Typography>
                </Box>
            )}
            
            <canvas
                ref={canvasRef}
                onClick={handleClick}
                style={{
                    maxWidth: '100%',
                    height: 'auto',
                    display: imageData ? 'block' : 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: cursor,
                }}
            />
        </Box>
    );
});

ImageCanvas.displayName = 'ImageCanvas';

export default ImageCanvas;