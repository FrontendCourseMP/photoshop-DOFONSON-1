import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Paper,
    Alert,
    Chip,
    Stack,
    Tooltip,
    IconButton,
} from '@mui/material';
import {
    Close as CloseIcon,
    Info as InfoIcon,
    Transform as TransformIcon,
} from '@mui/icons-material';
import { InterpolationMethod, interpolationDescriptions, scaleImage } from '../utils/interpolation';

interface ScaleModalProps {
    open: boolean;
    onClose: () => void;
    originalImageData: ImageData | null;
    onApplyScale: (scaledImageData: ImageData, newScalePercent: number) => void;
    currentScalePercent?: number;
}

type UnitType = 'percent' | 'pixels';

const MIN_WIDTH = 1;
const MAX_WIDTH = 8000;
const MIN_HEIGHT = 1;
const MAX_HEIGHT = 8000;
const MIN_PERCENT = 12;
const MAX_PERCENT = 300;

const formatMegapixels = (width: number, height: number): string => {
    const megapixels = (width * height) / 1000000;
    return megapixels.toFixed(2);
};

const ScaleModal: React.FC<ScaleModalProps> = ({
    open,
    onClose,
    originalImageData,
    onApplyScale,
    currentScalePercent = 100,
}) => {
    const [unitType, setUnitType] = useState<UnitType>('percent');
    const [width, setWidth] = useState<number>(100);
    const [height, setHeight] = useState<number>(100);
    const [widthPercent, setWidthPercent] = useState<number>(100);
    const [heightPercent, setHeightPercent] = useState<number>(100);
    const [method, setMethod] = useState<InterpolationMethod>('bilinear');
    const [errors, setErrors] = useState<{ width?: string; height?: string; widthPercent?: string; heightPercent?: string }>({});
    
    const [originalMegapixels, setOriginalMegapixels] = useState<string>('0');
    const [targetMegapixels, setTargetMegapixels] = useState<string>('0');
    
    const originalWidth = originalImageData?.width || 0;
    const originalHeight = originalImageData?.height || 0;
    
    useEffect(() => {
        if (open && originalImageData) {
            setOriginalMegapixels(formatMegapixels(originalWidth, originalHeight));
            
            setWidthPercent(currentScalePercent);
            setHeightPercent(currentScalePercent);
            
            const currentWidth = Math.round(originalWidth * (currentScalePercent / 100));
            const currentHeight = Math.round(originalHeight * (currentScalePercent / 100));
            setWidth(currentWidth);
            setHeight(currentHeight);
        }
    }, [open, originalImageData, originalWidth, originalHeight, currentScalePercent]);
    
    const validateValues = useCallback(() => {
        const newErrors: { width?: string; height?: string; widthPercent?: string; heightPercent?: string } = {};
        
        if (unitType === 'pixels') {
            if (width < MIN_WIDTH) {
                newErrors.width = `Минимальная ширина: ${MIN_WIDTH}px`;
            } else if (width > MAX_WIDTH) {
                newErrors.width = `Максимальная ширина: ${MAX_WIDTH}px`;
            }
            
            if (height < MIN_HEIGHT) {
                newErrors.height = `Минимальная высота: ${MIN_HEIGHT}px`;
            } else if (height > MAX_HEIGHT) {
                newErrors.height = `Максимальная высота: ${MAX_HEIGHT}px`;
            }
        } else {
            if (widthPercent < MIN_PERCENT) {
                newErrors.widthPercent = `Минимальный процент: ${MIN_PERCENT}%`;
            } else if (widthPercent > MAX_PERCENT) {
                newErrors.widthPercent = `Максимальный процент: ${MAX_PERCENT}%`;
            }
            
            if (heightPercent < MIN_PERCENT) {
                newErrors.heightPercent = `Минимальный процент: ${MIN_PERCENT}%`;
            } else if (heightPercent > MAX_PERCENT) {
                newErrors.heightPercent = `Максимальный процент: ${MAX_PERCENT}%`;
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [unitType, width, height, widthPercent, heightPercent]);
    
    const updateTargetMegapixels = useCallback(() => {
        setTargetMegapixels(formatMegapixels(width, height));
    }, [width, height]);
    
    useEffect(() => {
        updateTargetMegapixels();
    }, [width, height, updateTargetMegapixels]);
    
    const handleWidthPercentChange = (value: number) => {
        const clampedValue = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
        setWidthPercent(clampedValue);
        const newWidth = Math.round(originalWidth * (clampedValue / 100));
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };
    
    const handleHeightPercentChange = (value: number) => {
        const clampedValue = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
        setHeightPercent(clampedValue);
        const newHeight = Math.round(originalHeight * (clampedValue / 100));
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight)));
    };

    const handleWidthChange = (value: number) => {
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
        setWidth(newWidth);
        if (originalWidth > 0) {
            const newPercent = Math.round((newWidth / originalWidth) * 100);
            setWidthPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, newPercent)));
        }
    };
    
    const handleHeightChange = (value: number) => {
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
        setHeight(newHeight);
        if (originalHeight > 0) {
            const newPercent = Math.round((newHeight / originalHeight) * 100);
            setHeightPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, newPercent)));
        }
    };
    
    const handleUnitChange = (newUnit: UnitType) => {
        setUnitType(newUnit);
    };
    
    const handleApply = () => {
        if (!validateValues() || !originalImageData) return;
        
        const targetWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
        const targetHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
        
        const newScalePercent = Math.round((targetWidth / originalWidth) * 100);
        
        try {
            const scaledImageData = scaleImage(
                originalImageData,
                targetWidth,
                targetHeight,
                method
            );
            onApplyScale(scaledImageData, newScalePercent);
            onClose();
        } catch (error) {
            console.error('Ошибка при масштабировании:', error);
        }
    };
    
    const currentDescription = interpolationDescriptions[method];
    
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider'
            }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TransformIcon color="primary" />
                    <Typography variant="h6">Масштабирование изображения</Typography>
                </Stack>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers>
                <Stack spacing={3}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                            Информация о размере
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography variant="body2">
                                    <strong>Исходное изображение:</strong>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {originalWidth} × {originalHeight} px
                                    <br />
                                    {originalMegapixels} Мп
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2">
                                    <strong>Новое изображение:</strong>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {width} × {height} px
                                    <br />
                                    {targetMegapixels} Мп
                                </Typography>
                            </Grid>
                        </Grid>
                    </Paper>
                    
                    <FormControl fullWidth size="small">
                        <InputLabel>Единицы измерения</InputLabel>
                        <Select
                            value={unitType}
                            label="Единицы измерения"
                            onChange={(e) => handleUnitChange(e.target.value as UnitType)}
                        >
                            <MenuItem value="percent">Проценты (%)</MenuItem>
                            <MenuItem value="pixels">Пиксели (px)</MenuItem>
                        </Select>
                    </FormControl>
                    
                    {unitType === 'percent' ? (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    label="Ширина (%)"
                                    type="number"
                                    value={widthPercent}
                                    onChange={(e) => handleWidthPercentChange(Number(e.target.value))}
                                    error={!!errors.widthPercent}
                                    helperText={errors.widthPercent || `${MIN_PERCENT}% - ${MAX_PERCENT}%`}
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="body2" color="text.secondary">%</Typography>
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    label="Высота (%)"
                                    type="number"
                                    value={heightPercent}
                                    onChange={(e) => handleHeightPercentChange(Number(e.target.value))}
                                    error={!!errors.heightPercent}
                                    helperText={errors.heightPercent || `${MIN_PERCENT}% - ${MAX_PERCENT}%`}
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="body2" color="text.secondary">%</Typography>
                                    }}
                                />
                            </Grid>
                        </Grid>
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    label="Ширина"
                                    type="number"
                                    value={width}
                                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                                    error={!!errors.width}
                                    helperText={errors.width || `${MIN_WIDTH} - ${MAX_WIDTH} px`}
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="body2" color="text.secondary">px</Typography>
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    label="Высота"
                                    type="number"
                                    value={height}
                                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                                    error={!!errors.height}
                                    helperText={errors.height || `${MIN_HEIGHT} - ${MAX_HEIGHT} px`}
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="body2" color="text.secondary">px</Typography>
                                    }}
                                />
                            </Grid>
                        </Grid>
                    )}
                    
                    <FormControl fullWidth>
                        <InputLabel>Алгоритм интерполяции</InputLabel>
                        <Select
                            value={method}
                            label="Алгоритм интерполяции"
                            onChange={(e) => setMethod(e.target.value as InterpolationMethod)}
                        >
                            <MenuItem value="bilinear">
                                Билинейная интерполяция (Bilinear)
                            </MenuItem>
                            <MenuItem value="nearest-neighbor">
                                Ближайший сосед (Nearest Neighbor)
                            </MenuItem>
                        </Select>
                    </FormControl>
                    
                    <Tooltip
                        title={
                            <Box sx={{ p: 1, maxWidth: 300 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    {currentDescription.title}
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    {currentDescription.description}
                                </Typography>
                                <Typography variant="caption" display="block" gutterBottom>
                                    <strong>Преимущества:</strong>
                                </Typography>
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    {currentDescription.pros.map((pro, idx) => (
                                        <li key={idx}>
                                            <Typography variant="caption">{pro}</Typography>
                                        </li>
                                    ))}
                                </ul>
                            </Box>
                        }
                        arrow
                        placement="right"
                    >
                        <Chip
                            icon={<InfoIcon />}
                            label="Подробнее об алгоритме"
                            variant="outlined"
                            size="small"
                            sx={{ alignSelf: 'flex-start', cursor: 'pointer' }}
                        />
                    </Tooltip>
                    
                    <Alert severity="info" sx={{ mt: 1 }}>
                        <Typography variant="caption">
                            <strong>Примечание:</strong> При масштабировании создается новое изображение.
                            Оригинал остается неизменным. Для больших изображений процесс может занять некоторое время.
                        </Typography>
                    </Alert>
                </Stack>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={onClose} color="inherit">
                    Отмена
                </Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                    color="primary"
                    disabled={Object.keys(errors).length > 0}
                >
                    Применить
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScaleModal;