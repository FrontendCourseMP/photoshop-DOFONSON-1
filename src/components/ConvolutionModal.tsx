import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    TextField,
    Grid,
    Paper,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    CircularProgress,
    Alert,
    IconButton,
    Divider,
    Tooltip,
} from '@mui/material';
import {
    Close as CloseIcon,
    RestartAlt as ResetIcon,
    Check as ApplyIcon,
    Preview as PreviewIcon,
    Info as InfoIcon,
    Gradient as KernelIcon,
} from '@mui/icons-material';
import { Kernel, predefinedKernels, EdgeHandlingStrategy, applyConvolutionAsync, kernelToFlatArray, flatArrayToKernel } from '../utils/convolution';

interface ConvolutionModalProps {
    open: boolean;
    onClose: () => void;
    originalImageData: ImageData | null;
    onApply: (newImageData: ImageData) => void;
}

const KERNEL_SIZE = 3;
const KERNEL_CELLS = KERNEL_SIZE * KERNEL_SIZE;

const edgeHandlingDescriptions: Record<EdgeHandlingStrategy, string> = {
    black: 'Заполнение черным (0,0,0)',
    white: 'Заполнение белым (255,255,255)',
    clamp: 'Копирование ближайшего пикселя',
    mirror: 'Зеркальное отражение',
};

const ConvolutionModal: React.FC<ConvolutionModalProps> = ({
    open,
    onClose,
    originalImageData,
    onApply,
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>('identity');
    const [kernelValues, setKernelValues] = useState<number[]>(Array(KERNEL_CELLS).fill(0));
    const [divisor, setDivisor] = useState<number>(1);
    const [offset, setOffset] = useState<number>(0);
    const [edgeStrategy, setEdgeStrategy] = useState<EdgeHandlingStrategy>('clamp');
    const [applyToChannels, setApplyToChannels] = useState({
        red: true,
        green: true,
        blue: true,
        alpha: false,
    });
    const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const loadPreset = useCallback((presetKey: string) => {
        const preset = predefinedKernels[presetKey];
        if (preset) {
            const flatValues = kernelToFlatArray(preset);
            setKernelValues(flatValues);
            setDivisor(preset.divisor ?? 1);
            setOffset(preset.offset ?? 0);
        }
    }, []);
    
    const handlePresetChange = (presetKey: string) => {
        setSelectedPreset(presetKey);
        loadPreset(presetKey);
    };
    
    const handleKernelValueChange = (index: number, value: string) => {
        const numValue = parseInt(value) || 0;
        const newValues = [...kernelValues];
        newValues[index] = numValue;
        setKernelValues(newValues);
        setSelectedPreset('custom');
    };
    
    const handleReset = () => {
        loadPreset('identity');
        setSelectedPreset('identity');
        setEdgeStrategy('clamp');
        setApplyToChannels({ red: true, green: true, blue: true, alpha: false });
        setDivisor(1);
        setOffset(0);
    };
    
    const getCurrentKernel = useCallback((): Kernel => {
        const matrix: number[][] = [];
        for (let i = 0; i < KERNEL_SIZE; i++) {
            matrix.push(kernelValues.slice(i * KERNEL_SIZE, (i + 1) * KERNEL_SIZE));
        }
        return {
            name: selectedPreset === 'custom' ? 'Пользовательское ядро' : predefinedKernels[selectedPreset]?.name || 'Кастомное',
            matrix,
            divisor,
            offset,
        };
    }, [kernelValues, divisor, offset, selectedPreset]);
    
    const applyConvolution = useCallback(async (): Promise<ImageData | null> => {
        if (!originalImageData) return null;
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        
        try {
            const kernel = getCurrentKernel();
            const result = await applyConvolutionAsync(
                originalImageData,
                kernel,
                edgeStrategy,
                applyToChannels,
                (p) => setProgress(p),
                abortControllerRef.current.signal
            );
            return result;
        } catch (error) {
            if ((error as Error).message !== 'Операция отменена') {
                console.error('Ошибка при применении фильтра:', error);
            }
            return null;
        }
    }, [originalImageData, getCurrentKernel, edgeStrategy, applyToChannels]);
    
    const updatePreview = useCallback(async () => {
        if (!previewEnabled || !originalImageData || !previewCanvasRef.current) return;
        
        setIsProcessing(true);
        
        const result = await applyConvolution();
        
        if (result && previewCanvasRef.current) {
            const ctx = previewCanvasRef.current.getContext('2d');
            if (ctx) {
                previewCanvasRef.current.width = result.width;
                previewCanvasRef.current.height = result.height;
                ctx.putImageData(result, 0, 0);
            }
        }
        
        setIsProcessing(false);
    }, [previewEnabled, originalImageData, applyConvolution]);
    
    const debouncedUpdatePreview = useCallback(() => {
        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            updatePreview();
        }, 300);
    }, [updatePreview]);
    
    useEffect(() => {
        if (open && previewEnabled && originalImageData) {
            debouncedUpdatePreview();
        }
    }, [open, previewEnabled, originalImageData, kernelValues, divisor, offset, edgeStrategy, applyToChannels, debouncedUpdatePreview]);
    
    const handleApply = async () => {
        setIsProcessing(true);
        const result = await applyConvolution();
        if (result) {
            onApply(result);
        }
        setIsProcessing(false);
        onClose();
    };
    
    const handleClose = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        onClose();
    };
    
    useEffect(() => {
        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);
    
    if (!originalImageData) return null;
    
    const kernelSum = kernelValues.reduce((a, b) => a + b, 0);
    const effectiveDivisor = divisor === 0 ? 1 : divisor;
    
    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, minWidth: 800 }
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
                    <KernelIcon color="primary" />
                    <Typography variant="h6">Свертка изображения (Custom Filter)</Typography>
                </Stack>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={5}>
                        <Stack spacing={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Предустановленные ядра
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Выберите фильтр</InputLabel>
                                    <Select
                                        value={selectedPreset}
                                        label="Выберите фильтр"
                                        onChange={(e) => handlePresetChange(e.target.value)}
                                    >
                                        <MenuItem value="identity">Тождественное отображение</MenuItem>
                                        <MenuItem value="sharpen">Повышение резкости</MenuItem>
                                        <MenuItem value="gaussianBlur">Фильтр Гаусса (3x3)</MenuItem>
                                        <MenuItem value="boxBlur">Прямоугольное размытие</MenuItem>
                                        <MenuItem value="prewittX">Прюитт (горизонтальный)</MenuItem>
                                        <MenuItem value="prewittY">Прюитт (вертикальный)</MenuItem>
                                        <MenuItem value="edgeDetect">Обнаружение границ</MenuItem>
                                        <MenuItem value="emboss">Тиснение</MenuItem>
                                        <MenuItem value="custom">Пользовательское ядро</MenuItem>
                                    </Select>
                                </FormControl>
                            </Paper>
                            
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Ядро свертки (3x3)
                                </Typography>
                                <Box sx={{ display: 'inline-block', mx: 'auto' }}>
                                    <Grid container spacing={1} sx={{ width: 'auto' }}>
                                        {kernelValues.map((value, index) => (
                                            <Grid item key={index}>
                                                <TextField
                                                    type="number"
                                                    value={value}
                                                    onChange={(e) => handleKernelValueChange(index, e.target.value)}
                                                    size="small"
                                                    inputProps={{ 
                                                        step: 1,
                                                        style: { textAlign: 'center', width: 60 }
                                                    }}
                                                    variant="outlined"
                                                />
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                                
                                <Divider sx={{ my: 2 }} />
                                
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <TextField
                                            label="Делитель"
                                            type="number"
                                            value={divisor}
                                            onChange={(e) => setDivisor(Number(e.target.value) || 1)}
                                            size="small"
                                            fullWidth
                                            helperText={`Сумма ядра: ${kernelSum}`}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            label="Смещение"
                                            type="number"
                                            value={offset}
                                            onChange={(e) => setOffset(Number(e.target.value) || 0)}
                                            size="small"
                                            fullWidth
                                        />
                                    </Grid>
                                </Grid>
                                
                                {kernelSum !== 0 && kernelSum !== effectiveDivisor && (
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        <Typography variant="caption">
                                            Яркость изображения может измениться. Рекомендуется установить делитель равным сумме ядра ({kernelSum}).
                                        </Typography>
                                    </Alert>
                                )}
                            </Paper>
                            
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Обработка краев
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Стратегия заполнения</InputLabel>
                                    <Select
                                        value={edgeStrategy}
                                        label="Стратегия заполнения"
                                        onChange={(e) => setEdgeStrategy(e.target.value as EdgeHandlingStrategy)}
                                    >
                                        <MenuItem value="clamp">Копирование ближайшего пикселя</MenuItem>
                                        <MenuItem value="mirror">Зеркальное отражение</MenuItem>
                                        <MenuItem value="black">Заполнение черным</MenuItem>
                                        <MenuItem value="white">Заполнение белым</MenuItem>
                                    </Select>
                                </FormControl>
                                <Tooltip title={edgeHandlingDescriptions[edgeStrategy]} arrow>
                                    <InfoIcon fontSize="small" sx={{ mt: 1, color: 'text.secondary', cursor: 'help' }} />
                                </Tooltip>
                            </Paper>
                        </Stack>
                    </Grid>
                    
                    <Grid item xs={12} md={7}>
                        <Stack spacing={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Применить к каналам
                                </Typography>
                                <Stack direction="row" spacing={2}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={applyToChannels.red}
                                                onChange={(e) => setApplyToChannels(prev => ({ ...prev, red: e.target.checked }))}
                                                color="error"
                                            />
                                        }
                                        label="Красный (R)"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={applyToChannels.green}
                                                onChange={(e) => setApplyToChannels(prev => ({ ...prev, green: e.target.checked }))}
                                                color="success"
                                            />
                                        }
                                        label="Зеленый (G)"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={applyToChannels.blue}
                                                onChange={(e) => setApplyToChannels(prev => ({ ...prev, blue: e.target.checked }))}
                                                color="primary"
                                            />
                                        }
                                        label="Синий (B)"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={applyToChannels.alpha}
                                                onChange={(e) => setApplyToChannels(prev => ({ ...prev, alpha: e.target.checked }))}
                                                color="secondary"
                                            />
                                        }
                                        label="Альфа (A)"
                                    />
                                </Stack>
                            </Paper>
                            
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2">
                                        Предпросмотр
                                    </Typography>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={previewEnabled}
                                                onChange={(e) => setPreviewEnabled(e.target.checked)}
                                                icon={<PreviewIcon />}
                                                checkedIcon={<PreviewIcon color="primary" />}
                                            />
                                        }
                                        label="Живой предпросмотр"
                                    />
                                </Stack>
                                
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        bgcolor: '#f5f5f5',
                                        borderRadius: 1,
                                        p: 2,
                                        minHeight: 200,
                                        position: 'relative',
                                    }}
                                >
                                    {isProcessing && (
                                        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
                                            <CircularProgress size={40} />
                                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                                Обработка... {Math.round(progress)}%
                                            </Typography>
                                        </Box>
                                    )}
                                    <canvas
                                        ref={previewCanvasRef}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '300px',
                                            objectFit: 'contain',
                                            opacity: isProcessing ? 0.5 : 1,
                                        }}
                                    />
                                </Box>
                                
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    {selectedPreset !== 'custom' && predefinedKernels[selectedPreset]?.name}
                                    {selectedPreset === 'custom' && 'Пользовательское ядро'}
                                </Typography>
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={handleReset} startIcon={<ResetIcon />}>
                    Сбросить
                </Button>
                <Button onClick={handleClose} color="inherit">
                    Отмена
                </Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                    color="primary"
                    startIcon={<ApplyIcon />}
                    disabled={isProcessing}
                >
                    Применить
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConvolutionModal;