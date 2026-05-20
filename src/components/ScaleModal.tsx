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
    FormControlLabel,
    Checkbox,
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
    AspectRatio as AspectRatioIcon,
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
    const [percent, setPercent] = useState<number>(100);
    const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(true);
    const [method, setMethod] = useState<InterpolationMethod>('bilinear');
    const [errors, setErrors] = useState<{ width?: string; height?: string; percent?: string }>({});
    
    const [originalMegapixels, setOriginalMegapixels] = useState<string>('0');
    const [targetMegapixels, setTargetMegapixels] = useState<string>('0');
    
    const originalWidth = originalImageData?.width || 0;
    const originalHeight = originalImageData?.height || 0;
    const aspectRatio = originalWidth / originalHeight;
    
    useEffect(() => {
        if (open && originalImageData) {
            setOriginalMegapixels(formatMegapixels(originalWidth, originalHeight));
            
            const currentPercent = currentScalePercent;
            setPercent(currentPercent);
            
            const currentWidth = Math.round(originalWidth * (currentPercent / 100));
            const currentHeight = Math.round(originalHeight * (currentPercent / 100));
            setWidth(currentWidth);
            setHeight(currentHeight);
        }
    }, [open, originalImageData, originalWidth, originalHeight, currentScalePercent]);
    
    const validateValues = useCallback(() => {
        const newErrors: { width?: string; height?: string; percent?: string } = {};
        
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
            if (percent < MIN_PERCENT) {
                newErrors.percent = `Минимальный процент: ${MIN_PERCENT}%`;
            } else if (percent > MAX_PERCENT) {
                newErrors.percent = `Максимальный процент: ${MAX_PERCENT}%`;
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [unitType, width, height, percent]);
    
    const updateTargetMegapixels = useCallback(() => {
        let w = originalWidth;
        let h = originalHeight;
        
        if (unitType === 'pixels') {
            w = width;
            h = height;
        } else {
            w = Math.round(originalWidth * (percent / 100));
            h = Math.round(originalHeight * (percent / 100));
        }
        
        setTargetMegapixels(formatMegapixels(w, h));
    }, [unitType, width, height, percent, originalWidth, originalHeight]);
    
    useEffect(() => {
        updateTargetMegapixels();
    }, [unitType, width, height, percent, updateTargetMegapixels]);
    
    const handleWidthChange = (value: number) => {
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
        setWidth(newWidth);
        if (keepAspectRatio && originalWidth > 0) {
            const newHeight = Math.round(newWidth / aspectRatio);
            setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight)));
        }
        if (unitType === 'pixels' && originalWidth > 0) {
            const newPercent = Math.round((newWidth / originalWidth) * 100);
            if (newPercent >= MIN_PERCENT && newPercent <= MAX_PERCENT) {
                setPercent(newPercent);
            }
        }
    };
    
    const handleHeightChange = (value: number) => {
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
        setHeight(newHeight);
        if (keepAspectRatio && originalHeight > 0) {
            const newWidth = Math.round(newHeight * aspectRatio);
            setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
        }
        if (unitType === 'pixels' && originalHeight > 0) {
            const newPercent = Math.round((newHeight / originalHeight) * 100);
            if (newPercent >= MIN_PERCENT && newPercent <= MAX_PERCENT) {
                setPercent(newPercent);
            }
        }
    };
    
    const handlePercentChange = (value: number) => {
        const clampedValue = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
        setPercent(clampedValue);
        
        const newWidth = Math.round(originalWidth * (clampedValue / 100));
        const newHeight = Math.round(originalHeight * (clampedValue / 100));
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight)));
    };
    
    const handleUnitChange = (newUnit: UnitType) => {
        setUnitType(newUnit);
    };
    
    const handleApply = () => {
        if (!validateValues() || !originalImageData) return;
        
        let targetWidth: number, targetHeight: number;
        let newScalePercent: number;
        
        if (unitType === 'pixels') {
            targetWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
            targetHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
            newScalePercent = Math.round((targetWidth / originalWidth) * 100);
            newScalePercent = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, newScalePercent));
        } else {
            newScalePercent = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent));
            targetWidth = Math.round(originalWidth * (newScalePercent / 100));
            targetHeight = Math.round(originalHeight * (newScalePercent / 100));
        }
        
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
                                    {unitType === 'pixels' 
                                        ? `${width} × ${height} px`
                                        : `${Math.round(originalWidth * (percent / 100))} × ${Math.round(originalHeight * (percent / 100))} px`}
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
                        <TextField
                            label="Процент масштаба"
                            type="number"
                            value={percent}
                            onChange={(e) => handlePercentChange(Number(e.target.value))}
                            error={!!errors.percent}
                            helperText={errors.percent || `Диапазон: ${MIN_PERCENT}% - ${MAX_PERCENT}%`}
                            fullWidth
                            InputProps={{
                                endAdornment: <Typography variant="body2" color="text.secondary">%</Typography>
                            }}
                        />
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
                    
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={keepAspectRatio}
                                onChange={(e) => setKeepAspectRatio(e.target.checked)}
                                icon={<AspectRatioIcon />}
                                checkedIcon={<AspectRatioIcon color="primary" />}
                            />
                        }
                        label="Сохранять пропорции"
                    />
                    
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