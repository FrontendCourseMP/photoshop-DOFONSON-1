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
    TextField,
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
    Grid,
    InputAdornment,
} from '@mui/material';
import {
    RestartAlt as ResetIcon,
    Check as ApplyIcon,
    Close as CancelIcon,
    ShowChart as LinearIcon,
    Timeline as LogIcon,
    Adjust as BlackPointIcon,
    WbSunny as WhitePointIcon,
    BrightnessMedium as GammaIcon,
} from '@mui/icons-material';

interface LevelsDialogProps {
    open: boolean;
    onClose: (apply: boolean) => void;
    originalImageData: ImageData | null;
    currentImageData: ImageData | null;
    onApplyLevels: (imageData: ImageData) => void;
    isGrayBit?: boolean;
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
            case 'red': value = pixels[idx]; break;
            case 'green': value = pixels[idx + 1]; break;
            case 'blue': value = pixels[idx + 2]; break;
            case 'alpha': value = pixels[idx + 3]; break;
            default: 
                value = Math.round(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
                break;
        }
        histogram[value] = histogram[value] + 1;
    }
    return histogram;
};

const buildLUT = (inputBlack: number, inputWhite: number, gamma: number): Uint8Array => {
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
    isGrayBit = false,
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
    
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const histogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    const drawHistogramRef = useRef<() => void>(() => {});
    const drawPreviewRef = useRef<() => void>(() => {});
    
    const currentLevels = levels[selectedChannel];
    
    useEffect(() => {
        if (isGrayBit && (selectedChannel === 'red' || selectedChannel === 'green' || selectedChannel === 'blue')) {
            setSelectedChannel('master');
        }
    }, [isGrayBit, selectedChannel]);
    
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
            
            r = redLUT[masterLUT[r]];
            g = greenLUT[masterLUT[g]];
            b = blueLUT[masterLUT[b]];
            a = alphaLUT[a];
            
            dstPixels[srcIdx] = r;
            dstPixels[srcIdx + 1] = g;
            dstPixels[srcIdx + 2] = b;
            dstPixels[srcIdx + 3] = a;
        }
        return result;
    }, [originalImageData, levels]);
    
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
        if (result) onApplyLevels(result);
        onClose(true);
    };
    
    const updateLevel = (preset: PresetType, field: keyof ChannelLevels, value: number) => {
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
    
    const drawPreview = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (previewEnabled && originalImageData) {
            const newImageData = applyLevels();
            if (newImageData) {
                canvas.width = newImageData.width;
                canvas.height = newImageData.height;
                ctx.putImageData(newImageData, 0, 0);
            }
        } else if (!previewEnabled && currentImageData) {
            canvas.width = currentImageData.width;
            canvas.height = currentImageData.height;
            ctx.putImageData(currentImageData, 0, 0);
        }
    }, [previewEnabled, originalImageData, currentImageData, applyLevels]);
    
    useEffect(() => {
        drawPreviewRef.current = drawPreview;
    }, [drawPreview]);
    
    const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
        canvasRef.current = node;
        if (node && open) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    drawPreviewRef.current();
                });
            });
        }
    }, [open]);
    
    useEffect(() => {
        if (open && canvasRef.current) {
            drawPreview();
        }
    }, [open, drawPreview]);

    const drawHistogram = useCallback(() => {
        const canvas = histogramCanvasRef.current;
        if (!canvas || !histogramData) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const width = rect.width;
        const height = rect.height;
        
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#0a0a0a');
        bgGradient.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        for (let i = 1; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        
        let primaryColor = 'rgba(76, 175, 80, ';
        let secondaryColor = 'rgba(76, 175, 80, ';
        
        if (selectedChannel === 'red') {
            primaryColor = 'rgba(244, 67, 54, ';
            secondaryColor = 'rgba(244, 67, 54, ';
        } else if (selectedChannel === 'green') {
            primaryColor = 'rgba(76, 175, 80, ';
            secondaryColor = 'rgba(76, 175, 80, ';
        } else if (selectedChannel === 'blue') {
            primaryColor = 'rgba(33, 150, 243, ';
            secondaryColor = 'rgba(33, 150, 243, ';
        } else if (selectedChannel === 'alpha') {
            primaryColor = 'rgba(156, 39, 176, ';
            secondaryColor = 'rgba(156, 39, 176, ';
        }
        
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, secondaryColor + '0.1)');
        gradient.addColorStop(0.5, primaryColor + '0.5)');
        gradient.addColorStop(1, primaryColor + '0.9)');
        
        const barWidth = width / 256;
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = primaryColor + '0.6)';
        ctx.fillStyle = gradient;
        
        for (let i = 0; i < 256; i++) {
            let value = histogramData[i];
            if (histogramMode === 'log') {
                value = Math.log10(value + 1);
                const maxLog = Math.log10(maxHistogramValue + 1);
                const barHeight = (value / maxLog) * height;
                ctx.fillRect(i * barWidth, height - barHeight, barWidth + 1, barHeight);
            } else {
                const barHeight = (value / maxHistogramValue) * height;
                ctx.fillRect(i * barWidth, height - barHeight, barWidth + 1, barHeight);
            }
        }
        
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = primaryColor + '0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 256; i++) {
            let value = histogramData[i];
            if (histogramMode === 'log') {
                value = Math.log10(value + 1);
                const maxLog = Math.log10(maxHistogramValue + 1);
                const barHeight = (value / maxLog) * height;
                if (i === 0) ctx.moveTo(i * barWidth, height - barHeight);
                else ctx.lineTo(i * barWidth, height - barHeight);
            } else {
                const barHeight = (value / maxHistogramValue) * height;
                if (i === 0) ctx.moveTo(i * barWidth, height - barHeight);
                else ctx.lineTo(i * barWidth, height - barHeight);
            }
        }
        ctx.stroke();
        
        const blackX = (currentLevels.inputBlack / 255) * width;
        const whiteX = (currentLevels.inputWhite / 255) * width;
        const gammaNorm = 1 / currentLevels.inputGamma; 
        const gammaX = (gammaNorm / (gammaNorm + currentLevels.inputGamma)) * width; 
        
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(blackX, height);
        ctx.lineTo(blackX - 7, height - 14);
        ctx.lineTo(blackX + 7, height - 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(whiteX, 0);
        ctx.lineTo(whiteX - 7, 14);
        ctx.lineTo(whiteX + 7, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowColor = 'rgba(255, 152, 0, 0.5)';
        ctx.fillStyle = '#ff9800';
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(gammaX, height);
        ctx.lineTo(gammaX - 7, height - 14);
        ctx.lineTo(gammaX + 7, height - 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.moveTo(blackX, 0);
        ctx.lineTo(blackX, height - 14);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(whiteX, 14);
        ctx.lineTo(whiteX, height);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(gammaX, 0);
        ctx.lineTo(gammaX, height - 14);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '11px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0', 15, height - 18);
        ctx.fillText('128', width / 2, height - 18);
        ctx.fillText('255', width - 15, height - 18);
        
    }, [histogramData, maxHistogramValue, histogramMode, currentLevels, selectedChannel]);
    
    useEffect(() => {
        drawHistogramRef.current = drawHistogram;
    }, [drawHistogram]);
    
    const setHistogramCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
        histogramCanvasRef.current = node;
        if (node) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    drawHistogramRef.current();
                });
            });
        }
    }, []);
    
    useEffect(() => {
        if (open && histogramCanvasRef.current) {
            drawHistogram();
        }
    }, [open, histogramData, histogramMode, currentLevels, drawHistogram]);

    useEffect(() => {
        const handleResize = () => {
            drawHistogram();
            if (open && canvasRef.current) drawPreview();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [drawHistogram, drawPreview, open]);
    
    if (!originalImageData) return null;
    
    return (
        <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Коррекция уровней (Levels)</Typography>
                    <ToggleButtonGroup
                        size="small"
                        value={histogramMode}
                        exclusive
                        onChange={(_, val) => val && setHistogramMode(val)}
                    >
                        <ToggleButton value="linear">
                            <LinearIcon sx={{ mr: 0.5, fontSize: 18 }} /> Лин.
                        </ToggleButton>
                        <ToggleButton value="log">
                            <LogIcon sx={{ mr: 0.5, fontSize: 18 }} /> Лог.
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            </DialogTitle>
            
            <DialogContent dividers sx={{ minHeight: 400 }}>
                <Stack spacing={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Канал для коррекции</InputLabel>
                        <Select
                            value={selectedChannel}
                            label="Канал для коррекции"
                            onChange={(e) => setSelectedChannel(e.target.value as PresetType)}
                        >
                            <MenuItem value="master">Master (Яркость / RGB)</MenuItem>
                            {!isGrayBit && <MenuItem value="red">Красный (Red)</MenuItem>}
                            {!isGrayBit && <MenuItem value="green">Зеленый (Green)</MenuItem>}
                            {!isGrayBit && <MenuItem value="blue">Синий (Blue)</MenuItem>}
                            <MenuItem value="alpha">Альфа-канал (Alpha)</MenuItem>
                        </Select>
                    </FormControl>
                    
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Гистограмма {selectedChannel === 'master' ? 'яркости' : `канала ${selectedChannel}`}
                        </Typography>
                        <canvas
                            ref={setHistogramCanvasRef}
                            style={{
                                width: '100%',
                                height: '180px',
                                backgroundColor: '#0a0a0a',
                                borderRadius: '8px',
                                border: '1px solid #333',
                                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                            }}
                        />
                        <Stack direction="row" justifyContent="space-between" px={1} mt={0.5}>
                            <Typography variant="caption" color="text.secondary">Тени (0)</Typography>
                            <Typography variant="caption" color="text.secondary">Света (255)</Typography>
                        </Stack>
                    </Box>
                    
                    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                            Входные уровни
                        </Typography>
                        
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <BlackPointIcon sx={{ color: 'text.primary', fontSize: 20 }} />
                                    <Typography variant="body2" fontWeight="medium">Черная точка</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Slider
                                        value={currentLevels.inputBlack}
                                        min={0} max={254} step={1}
                                        onChange={(_, val) => updateLevel(selectedChannel, 'inputBlack', val as number)}
                                        size="small"
                                        sx={{ flexGrow: 1 }}
                                    />
                                    <TextField
                                        size="small"
                                        type="number"
                                        value={currentLevels.inputBlack}
                                        onChange={(e) => updateLevel(selectedChannel, 'inputBlack', Number(e.target.value))}
                                        inputProps={{ min: 0, max: 254, step: 1 }}
                                        sx={{ width: 70 }}
                                    />
                                </Stack>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <GammaIcon sx={{ color: '#ff9800', fontSize: 20 }} />
                                    <Typography variant="body2" fontWeight="medium">Гамма (Средние тона)</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Slider
                                        value={currentLevels.inputGamma}
                                        min={0.1} max={9.9} step={0.01}
                                        onChange={(_, val) => updateLevel(selectedChannel, 'inputGamma', val as number)}
                                        size="small"
                                        sx={{ flexGrow: 1 }}
                                    />
                                    <TextField
                                        size="small"
                                        type="number"
                                        value={currentLevels.inputGamma.toFixed(2)}
                                        onChange={(e) => updateLevel(selectedChannel, 'inputGamma', Number(e.target.value))}
                                        inputProps={{ min: 0.1, max: 9.9, step: 0.01 }}
                                        sx={{ width: 70 }}
                                        InputProps={{
                                            endAdornment: <InputAdornment position="end">γ</InputAdornment>,
                                        }}
                                    />
                                </Stack>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <WhitePointIcon sx={{ color: 'text.primary', fontSize: 20 }} />
                                    <Typography variant="body2" fontWeight="medium">Белая точка</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Slider
                                        value={currentLevels.inputWhite}
                                        min={1} max={255} step={1}
                                        onChange={(_, val) => updateLevel(selectedChannel, 'inputWhite', val as number)}
                                        size="small"
                                        sx={{ flexGrow: 1 }}
                                    />
                                    <TextField
                                        size="small"
                                        type="number"
                                        value={currentLevels.inputWhite}
                                        onChange={(e) => updateLevel(selectedChannel, 'inputWhite', Number(e.target.value))}
                                        inputProps={{ min: 1, max: 255, step: 1 }}
                                        sx={{ width: 70 }}
                                    />
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>
                    
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={previewEnabled}
                                    onChange={(e) => setPreviewEnabled(e.target.checked)}
                                />
                            }
                            label="Предпросмотр в реальном времени"
                        />
                        <Button 
                            size="small" 
                            startIcon={<ResetIcon />} 
                            onClick={handleReset}
                            variant="outlined"
                        >
                            Сбросить значения
                        </Button>
                    </Stack>
                    
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Результат
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                bgcolor: '#e0e0e0',
                                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                borderRadius: 2,
                                p: 2,
                                minHeight: 120,
                                border: '1px solid #ccc'
                            }}
                        >
                            <canvas
                                ref={setCanvasRef}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '250px',
                                    objectFit: 'contain',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                            />
                        </Box>
                    </Box>
                </Stack>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={() => onClose(false)} startIcon={<CancelIcon />} color="inherit">
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