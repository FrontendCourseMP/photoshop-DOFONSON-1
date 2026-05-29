import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Slider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    Button,
    Stack,
    Chip,
} from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    CenterFocusStrong as FitIcon,
    Transform as TransformIcon,
} from '@mui/icons-material';
import { InterpolationMethod, scaleImage, interpolationDescriptions } from '../utils/interpolation';

interface ScaleControlProps {
    originalImageData: ImageData | null;
    scale: number;
    onScaleChange: (newScale: number) => void;
    onScaledImageChange: (scaledImageData: ImageData, scalePercent: number) => void;
    onFitToScreen: () => void;
    onOpenScaleModal: () => void;
}

const MIN_SCALE = 12;
const MAX_SCALE = 300;

const ScaleControl: React.FC<ScaleControlProps> = ({
    originalImageData,
    scale,
    onScaleChange,
    onScaledImageChange,
    onFitToScreen,
    onOpenScaleModal,
}) => {
    const [method, setMethod] = useState<InterpolationMethod>('bilinear');
    const isUpdatingRef = useRef(false);

    const applyScale = useCallback(async (newScale: number, interpolationMethod: InterpolationMethod) => {
        if (!originalImageData) return;
        if (isUpdatingRef.current) return; 

        isUpdatingRef.current = true;
        try {
            const newWidth = Math.max(1, Math.round(originalImageData.width * (newScale / 100)));
            const newHeight = Math.max(1, Math.round(originalImageData.height * (newScale / 100)));
            const scaledImageData = scaleImage(originalImageData, newWidth, newHeight, interpolationMethod);
            onScaledImageChange(scaledImageData, newScale);
        } catch (error) {
            console.error('Ошибка при масштабировании:', error);
        } finally {
            isUpdatingRef.current = false;
        }
    }, [originalImageData, onScaledImageChange]);

    const handleSliderChange = (_event: Event, newValue: number | number[]) => {
        onScaleChange(newValue as number);
    };

    const handleZoomIn = () => {
        const newScale = Math.min(MAX_SCALE, scale + 10);
        onScaleChange(newScale);
    };

    const handleZoomOut = () => {
        const newScale = Math.max(MIN_SCALE, scale - 10);
        onScaleChange(newScale);
    };

    const handleMethodChange = (newMethod: InterpolationMethod) => {
        setMethod(newMethod);
        applyScale(scale, newMethod);
    };

    useEffect(() => {
        applyScale(scale, method);
    }, [scale, method, originalImageData, applyScale]);

    if (!originalImageData) return null;

    const scaledWidth = Math.round(originalImageData.width * (scale / 100));
    const scaledHeight = Math.round(originalImageData.height * (scale / 100));

    return (
        <Paper sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" color="text.secondary">
                        Масштаб: {scale}% ({scaledWidth}×{scaledHeight} px)
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Открыть окно масштабирования">
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<TransformIcon />}
                                onClick={onOpenScaleModal}
                            >
                                Изменить размер
                            </Button>
                        </Tooltip>
                    </Stack>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                    <IconButton onClick={handleZoomOut} disabled={scale <= MIN_SCALE} size="small">
                        <ZoomOutIcon />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                        <Slider
                            value={scale}
                            onChange={handleSliderChange}
                            min={MIN_SCALE}
                            max={MAX_SCALE}
                            step={1}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value}%`}
                        />
                    </Box>
                    <IconButton onClick={handleZoomIn} disabled={scale >= MAX_SCALE} size="small">
                        <ZoomInIcon />
                    </IconButton>
                    <Tooltip title="Вписать в окно">
                        <IconButton onClick={onFitToScreen} size="small">
                            <FitIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Интерполяция</InputLabel>
                        <Select
                            value={method}
                            label="Интерполяция"
                            onChange={(e) => handleMethodChange(e.target.value as InterpolationMethod)}
                        >
                            <MenuItem value="bilinear">Билинейная (по умолчанию)</MenuItem>
                            <MenuItem value="nearest-neighbor">Ближайший сосед</MenuItem>
                        </Select>
                    </FormControl>
                    <Tooltip
                        title={
                            <Box sx={{ p: 1 }}>
                                <Typography variant="body2">
                                    {interpolationDescriptions[method].description}
                                </Typography>
                            </Box>
                        }
                        arrow
                    >
                        <Chip
                            label={`Активен: ${interpolationDescriptions[method].title.split(' ')[0]}`}
                            size="small"
                            variant="outlined"
                        />
                    </Tooltip>
                </Stack>
            </Stack>
        </Paper>
    );
};

export default ScaleControl;