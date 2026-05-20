import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    onScaledImageChange: (scaledImageData: ImageData, scalePercent: number) => void;  
    containerRef: React.RefObject<HTMLElement>;
    onOpenScaleModal: () => void;
    externalScale?: number;
    onScaleChange?: (scale: number) => void;
}

const MIN_SCALE = 12;
const MAX_SCALE = 300;
const DEFAULT_SCALE = 100;
const PADDING = 50;

const ScaleControl: React.FC<ScaleControlProps> = ({
    originalImageData,
    onScaledImageChange,
    containerRef,
    onOpenScaleModal,
    externalScale,
    onScaleChange,
}) => {
    const [scale, setScale] = useState<number>(externalScale ?? DEFAULT_SCALE);
    const [method, setMethod] = useState<InterpolationMethod>('bilinear');
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastAppliedScaleRef = useRef<number>(externalScale ?? DEFAULT_SCALE);
    const isInitialMount = useRef<boolean>(true);
    
    const calculateFitScale = useCallback((): number => {
        if (!originalImageData || !containerRef.current) return DEFAULT_SCALE;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const availableWidth = containerRect.width - PADDING * 2;
        const availableHeight = containerRect.height - PADDING * 2;
        
        const scaleX = (availableWidth / originalImageData.width) * 100;
        const scaleY = (availableHeight / originalImageData.height) * 100;
        
        let fitScale = Math.min(scaleX, scaleY);
        fitScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.floor(fitScale)));
        
        return fitScale;
    }, [originalImageData, containerRef]);
    
    const applyScale = useCallback(async (newScale: number, interpolationMethod: InterpolationMethod) => {
        if (!originalImageData) return;
        
        if (lastAppliedScaleRef.current === newScale && !isInitialMount.current) return;
        
        setIsUpdating(true);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        try {
            const newWidth = Math.max(1, Math.round(originalImageData.width * (newScale / 100)));
            const newHeight = Math.max(1, Math.round(originalImageData.height * (newScale / 100)));
            
            const scaledImageData = scaleImage(
                originalImageData,
                newWidth,
                newHeight,
                interpolationMethod
            );
            
            lastAppliedScaleRef.current = newScale;
            onScaledImageChange(scaledImageData, newScale);
            onScaleChange?.(newScale);
        } catch (error) {
            console.error('Ошибка при масштабировании:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [originalImageData, onScaledImageChange, onScaleChange]);
    
    const handleScaleChange = (_event: Event, newValue: number | number[]) => {
        const newScale = newValue as number;
        setScale(newScale);
        
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        
        updateTimeoutRef.current = setTimeout(() => {
            applyScale(newScale, method);
        }, 100);
    };
    
    const handleFitToScreen = () => {
        const fitScale = calculateFitScale();
        setScale(fitScale);
        applyScale(fitScale, method);
    };
    
    const handleZoomIn = () => {
        const newScale = Math.min(MAX_SCALE, scale + 10);
        setScale(newScale);
        applyScale(newScale, method);
    };
    
    const handleZoomOut = () => {
        const newScale = Math.max(MIN_SCALE, scale - 10);
        setScale(newScale);
        applyScale(newScale, method);
    };
    
    const handleMethodChange = (newMethod: InterpolationMethod) => {
        setMethod(newMethod);
        applyScale(scale, newMethod);
    };
    
    useEffect(() => {
        if (externalScale !== undefined && externalScale !== scale) {
            setScale(externalScale);
            lastAppliedScaleRef.current = externalScale;
            applyScale(externalScale, method);
        }
    }, [externalScale]);
    
    useEffect(() => {
        if (originalImageData && isInitialMount.current) {
            isInitialMount.current = false;
            applyScale(scale, method);
        }
    }, [originalImageData]);
    
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);
    
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
                    <IconButton
                        onClick={handleZoomOut}
                        disabled={scale <= MIN_SCALE || isUpdating}
                        size="small"
                    >
                        <ZoomOutIcon />
                    </IconButton>
                    
                    <Box sx={{ flexGrow: 1 }}>
                        <Slider
                            value={scale}
                            onChange={handleScaleChange}
                            min={MIN_SCALE}
                            max={MAX_SCALE}
                            step={1}
                            disabled={isUpdating}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value}%`}
                        />
                    </Box>
                    
                    <IconButton
                        onClick={handleZoomIn}
                        disabled={scale >= MAX_SCALE || isUpdating}
                        size="small"
                    >
                        <ZoomInIcon />
                    </IconButton>
                    
                    <Tooltip title="Вписать в окно">
                        <IconButton onClick={handleFitToScreen} disabled={isUpdating} size="small">
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
                            disabled={isUpdating}
                        >
                            <MenuItem value="bilinear">
                                Билинейная (по умолчанию)
                            </MenuItem>
                            <MenuItem value="nearest-neighbor">
                                Ближайший сосед
                            </MenuItem>
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