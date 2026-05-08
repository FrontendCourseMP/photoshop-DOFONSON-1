import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Slider,
    FormControlLabel,
    Checkbox,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    ToggleButton,
    ToggleButtonGroup,
    Paper,
    Stack,
    Alert,
} from '@mui/material';
import {
    RestartAlt as ResetIcon,
    Check as ApplyIcon,
    Close as CancelIcon,
    ShowChart as LinearIcon,
    Timeline as LogIcon,
} from '@mui/icons-material';

interface LevelsDialogProps {
    open: boolean;
    onClose: (apply: boolean) => void;
    originalImageData: ImageData | null;
    currentImageData: ImageData | null;
    onApplyLevels: (imageData: ImageData) => void;
}

interface ChannelLevels {
    inputBlack: number;
    inputWhite: number;
    inputGamma: number;
}

type PresetType = 'master' | 'red' | 'green' | 'blue' | 'alpha';

const applyLevelsToPixel = (
    value: number,
    inputBlack: number,
    inputWhite: number,
    gamma: number
): number => {
    let normalized = (value - inputBlack) / (inputWhite - inputBlack);
    normalized = Math.max(0, Math.min(1, normalized));
    const corrected = Math.pow(normalized, 1 / gamma);
    return Math.round(corrected * 255);
};

const buildHistogram = (
    imageData: ImageData,
    channel: PresetType
): Uint32Array => {
    const histogram = new Uint32Array(256);
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        let value: number;
        
        switch (channel) {
            case 'red':
                value = pixels[idx];
                break;
            case 'green':
                value = pixels[idx + 1];
                break;
            case 'blue':
                value = pixels[idx + 2];
                break;
            case 'alpha':
                value = pixels[idx + 3];
                break;
            default: 
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                value = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                break;
        }
        
        histogram[value] = histogram[value] + 1;
    }
    
    return histogram;
};

const buildLUT = (
    inputBlack: number,
    inputWhite: number,
    gamma: number
): Uint8Array => {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        lut[i] = applyLevelsToPixel(i, inputBlack, inputWhite, gamma);
    }
    return lut;
};

const LevelsDialog: React.FC<LevelsDialogProps> = ({
    open,
    onClose,
    originalImageData,
    currentImageData,
    onApplyLevels,
}) => {
    const [levels, setLevels] = useState<Record<PresetType, ChannelLevels>>({
        master: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
        red: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
        green: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
        blue: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
        alpha: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
    });
    
    const [selectedChannel, setSelectedChannel] = useState<PresetType>('master');
    const [histogramData, setHistogramData] = useState<Uint32Array | null>(null);
    const [maxHistogramValue, setMaxHistogramValue] = useState<number>(1);
    const [histogramMode, setHistogramMode] = useState<'linear' | 'log'>('linear');
    const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);
    
    const animationFrameRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const histogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    const currentLevels = levels[selectedChannel];
    
    useEffect(() => {
        if (originalImageData) {
            const hist = buildHistogram(originalImageData, selectedChannel);
            let max = 0;
            for (let i = 0; i < hist.length; i++) {
                if (hist[i] > max) max = hist[i];
            }
            setMaxHistogramValue(max > 0 ? max : 1);
            setHistogramData(hist);
        }
    }, [originalImageData, selectedChannel]);
    
    const applyLevels = useCallback(() => {
        if (!originalImageData) return null;
        
        const width = originalImageData.width;
        const height = originalImageData.height;
        const srcPixels = originalImageData.data;
        const result = new ImageData(width, height);
        const dstPixels = result.data;
        
        const redLUT = buildLUT(levels.red.inputBlack, levels.red.inputWhite, levels.red.inputGamma);
        const greenLUT = buildLUT(levels.green.inputBlack, levels.green.inputWhite, levels.green.inputGamma);
        const blueLUT = buildLUT(levels.blue.inputBlack, levels.blue.inputWhite, levels.blue.inputGamma);
        const alphaLUT = buildLUT(levels.alpha.inputBlack, levels.alpha.inputWhite, levels.alpha.inputGamma);
        
        const masterLUT = buildLUT(levels.master.inputBlack, levels.master.inputWhite, levels.master.inputGamma);
        
        for (let i = 0; i < width * height; i++) {
            const srcIdx = i * 4;
            let r = srcPixels[srcIdx];
            let g = srcPixels[srcIdx + 1];
            let b = srcPixels[srcIdx + 2];
            let a = srcPixels[srcIdx + 3];
            
            r = masterLUT[r];
            g = masterLUT[g];
            b = masterLUT[b];
            
            r = redLUT[r];
            g = greenLUT[g];
            b = blueLUT[b];
            a = alphaLUT[a];
            
            dstPixels[srcIdx] = r;
            dstPixels[srcIdx + 1] = g;
            dstPixels[srcIdx + 2] = b;
            dstPixels[srcIdx + 3] = a;
        }
        
        return result;
    }, [originalImageData, levels]);
    
    const updatePreview = useCallback(() => {
        if (previewEnabled && originalImageData) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            animationFrameRef.current = requestAnimationFrame(() => {
                const newImageData = applyLevels();
                if (newImageData && canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        canvasRef.current.width = newImageData.width;
                        canvasRef.current.height = newImageData.height;
                        ctx.putImageData(newImageData, 0, 0);
                    }
                }
            });
        }
    }, [previewEnabled, originalImageData, applyLevels]);
    
    useEffect(() => {
        if (open && previewEnabled) {
            updatePreview();
        } else if (open && !previewEnabled && currentImageData && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                canvasRef.current.width = currentImageData.width;
                canvasRef.current.height = currentImageData.height;
                ctx.putImageData(currentImageData, 0, 0);
            }
        }
    }, [open, previewEnabled, levels, selectedChannel, updatePreview, currentImageData]);
    
    const handleReset = () => {
        setLevels({
            master: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
            red: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
            green: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
            blue: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
            alpha: { inputBlack: 0, inputWhite: 255, inputGamma: 1.0 },
        });
    };
    
    const handleApply = () => {
        const result = applyLevels();
        if (result) {
            onApplyLevels(result);
        }
        onClose(true);
    };
    
    const handleCancel = () => {
        onClose(false);
    };
    
    const updateLevel = (
        preset: PresetType,
        field: keyof ChannelLevels,
        value: number
    ) => {
        setLevels(prev => {
            const newLevels = { ...prev };
            const current = { ...newLevels[preset] };
            
            if (field === 'inputBlack') {
                current.inputBlack = Math.min(value, current.inputWhite - 1);
                current.inputBlack = Math.max(0, current.inputBlack);
            } else if (field === 'inputWhite') {
                current.inputWhite = Math.max(value, current.inputBlack + 1);
                current.inputWhite = Math.min(255, current.inputWhite);
            } else if (field === 'inputGamma') {
                current.inputGamma = Math.min(9.9, Math.max(0.1, value));
            }
            
            newLevels[preset] = current;
            return newLevels;
        });
    };
    
    const drawHistogram = useCallback(() => {
        const canvas = histogramCanvasRef.current;
        if (!canvas || !histogramData) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        const barWidth = width / 256;
        
        for (let i = 0; i < 256; i++) {
            let value = histogramData[i];
            
            if (histogramMode === 'log') {
                value = Math.log10(value + 1);
                const maxLog = Math.log10(maxHistogramValue + 1);
                const barHeight = (value / maxLog) * height;
                ctx.fillStyle = `rgba(76, 175, 80, 0.8)`;
                ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
            } else {
                const barHeight = (value / maxHistogramValue) * height;
                ctx.fillStyle = `rgba(76, 175, 80, 0.8)`;
                ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
            }
        }
        
        const blackX = (currentLevels.inputBlack / 255) * width;
        const whiteX = (currentLevels.inputWhite / 255) * width;
        const gammaX = (Math.pow(currentLevels.inputGamma, 0.4) / 2.5) * width;
        
        ctx.fillStyle = '#2196f3';
        ctx.fillRect(blackX - 2, 0, 4, height);
        
        ctx.fillStyle = '#f44336';
        ctx.fillRect(whiteX - 2, 0, 4, height);
        
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(gammaX - 2, 0, 4, height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Roboto';
        ctx.fillText('0', 2, height - 2);
        ctx.fillText('128', width / 2 - 10, height - 2);
        ctx.fillText('255', width - 25, height - 2);
    }, [histogramData, maxHistogramValue, histogramMode, currentLevels]);
    
    useEffect(() => {
        if (histogramCanvasRef.current) {
            histogramCanvasRef.current.width = 600;
            histogramCanvasRef.current.height = 150;
            drawHistogram();
        }
    }, [histogramData, histogramMode, currentLevels, drawHistogram]);
    
    useEffect(() => {
        if (open && histogramCanvasRef.current) {
            histogramCanvasRef.current.width = 600;
            histogramCanvasRef.current.height = 150;
            drawHistogram();
        }
    }, [open, drawHistogram]);
    
    if (!originalImageData) return null;
    
    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { minWidth: 700 }
            }}
        >
            <DialogTitle>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Уровни (Levels)</Typography>
                    <ToggleButtonGroup
                        size="small"
                        value={histogramMode}
                        exclusive
                        onChange={(_, val) => val && setHistogramMode(val)}
                    >
                        <ToggleButton value="linear">
                            <LinearIcon sx={{ mr: 0.5 }} /> Линейная
                        </ToggleButton>
                        <ToggleButton value="log">
                            <LogIcon sx={{ mr: 0.5 }} /> Логарифмическая
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            </DialogTitle>
            
            <DialogContent dividers>
                <Stack spacing={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Канал</InputLabel>
                        <Select
                            value={selectedChannel}
                            label="Канал"
                            onChange={(e) => setSelectedChannel(e.target.value as PresetType)}
                        >
                            <MenuItem value="master">Master (RGB)</MenuItem>
                            <MenuItem value="red">Красный (Red)</MenuItem>
                            <MenuItem value="green">Зеленый (Green)</MenuItem>
                            <MenuItem value="blue">Синий (Blue)</MenuItem>
                            <MenuItem value="alpha">Альфа (Alpha)</MenuItem>
                        </Select>
                    </FormControl>
                    
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            Гистограмма {selectedChannel === 'master' ? 'яркости' : selectedChannel}
                        </Typography>
                        <canvas
                            ref={histogramCanvasRef}
                            style={{
                                width: '100%',
                                height: '150px',
                                backgroundColor: '#1e1e1e',
                                borderRadius: '4px',
                                marginTop: '8px',
                            }}
                        />
                    </Box>
                    
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Входные уровни
                        </Typography>
                        
                        <Box sx={{ px: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                                Черный: {currentLevels.inputBlack}
                            </Typography>
                            <Slider
                                value={currentLevels.inputBlack}
                                min={0}
                                max={254}
                                step={1}
                                onChange={(_, val) => updateLevel(selectedChannel, 'inputBlack', val as number)}
                                sx={{ mb: 2 }}
                            />
                            
                            <Typography variant="caption" color="text.secondary">
                                Гамма: {currentLevels.inputGamma.toFixed(2)}
                            </Typography>
                            <Slider
                                value={currentLevels.inputGamma}
                                min={0.1}
                                max={9.9}
                                step={0.01}
                                onChange={(_, val) => updateLevel(selectedChannel, 'inputGamma', val as number)}
                                sx={{ mb: 2 }}
                            />
                            
                            <Typography variant="caption" color="text.secondary">
                                Белый: {currentLevels.inputWhite}
                            </Typography>
                            <Slider
                                value={currentLevels.inputWhite}
                                min={1}
                                max={255}
                                step={1}
                                onChange={(_, val) => updateLevel(selectedChannel, 'inputWhite', val as number)}
                            />
                        </Box>
                    </Paper>
                    
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={previewEnabled}
                                onChange={(e) => setPreviewEnabled(e.target.checked)}
                            />
                        }
                        label="Предпросмотр (Live Preview)"
                    />
                    
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            Предпросмотр результата
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                mt: 1,
                                bgcolor: '#f5f5f5',
                                borderRadius: 1,
                                p: 1,
                                minHeight: 150,
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '200px',
                                    objectFit: 'contain',
                                }}
                            />
                        </Box>
                    </Box>
                    
                    <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="caption">
                            <strong>Совет:</strong> Черный маркер определяет, какое значение считается черным.
                            Белый маркер — какое значение считается белым.
                            Гамма управляет средними тонами (1.0 — линейно, {'<'}1 — осветление, {'>'}1 — затемнение).
                        </Typography>
                    </Alert>
                </Stack>
            </DialogContent>
            
            <DialogActions>
                <Button onClick={handleReset} startIcon={<ResetIcon />}>
                    Сброс
                </Button>
                <Button onClick={handleCancel} startIcon={<CancelIcon />} color="inherit">
                    Отмена
                </Button>
                <Button onClick={handleApply} startIcon={<ApplyIcon />} variant="contained" color="primary">
                    Применить
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LevelsDialog;
