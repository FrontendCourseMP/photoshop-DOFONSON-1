export type EdgeHandlingStrategy = 'black' | 'white' | 'clamp' | 'mirror';

export interface Kernel {
    name: string;
    matrix: number[][];
    divisor?: number;
    offset?: number;
}

export const predefinedKernels: Record<string, Kernel> = {
    identity: {
        name: 'Тождественное отображение',
        matrix: [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0]
        ],
        divisor: 1,
        offset: 0
    },
    sharpen: {
        name: 'Повышение резкости',
        matrix: [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ],
        divisor: 1,
        offset: 0
    },
    gaussianBlur: {
        name: 'Фильтр Гаусса (3x3)',
        matrix: [
            [1, 2, 1],
            [2, 4, 2],
            [1, 2, 1]
        ],
        divisor: 16,
        offset: 0
    },
    boxBlur: {
        name: 'Прямоугольное размытие',
        matrix: [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1]
        ],
        divisor: 9,
        offset: 0
    },
    prewittX: {
        name: 'Прюитт (горизонтальный)',
        matrix: [
            [-1, 0, 1],
            [-1, 0, 1],
            [-1, 0, 1]
        ],
        divisor: 1,
        offset: 0
    },
    prewittY: {
        name: 'Прюитт (вертикальный)',
        matrix: [
            [-1, -1, -1],
            [0, 0, 0],
            [1, 1, 1]
        ],
        divisor: 1,
        offset: 0
    },
    edgeDetect: {
        name: 'Обнаружение границ',
        matrix: [
            [-1, -1, -1],
            [-1, 8, -1],
            [-1, -1, -1]
        ],
        divisor: 1,
        offset: 0
    },
    emboss: {
        name: 'Тиснение',
        matrix: [
            [-2, -1, 0],
            [-1, 1, 1],
            [0, 1, 2]
        ],
        divisor: 1,
        offset: 128
    }
};

const getPixelWithEdgeHandling = (
    imageData: ImageData,
    x: number,
    y: number,
    strategy: EdgeHandlingStrategy
): [number, number, number, number] => {
    const width = imageData.width;
    const height = imageData.height;
    
    let srcX = x;
    let srcY = y;
    
    switch (strategy) {
        case 'black':
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return [0, 0, 0, 255];
            }
            break;
        case 'white':
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return [255, 255, 255, 255];
            }
            break;
        case 'clamp':
            srcX = Math.min(Math.max(0, x), width - 1);
            srcY = Math.min(Math.max(0, y), height - 1);
            break;
        case 'mirror':
            if (x < 0) srcX = -x - 1;
            else if (x >= width) srcX = width * 2 - x - 1;
            if (y < 0) srcY = -y - 1;
            else if (y >= height) srcY = height * 2 - y - 1;
            srcX = Math.min(Math.max(0, srcX), width - 1);
            srcY = Math.min(Math.max(0, srcY), height - 1);
            break;
    }
    
    const idx = (srcY * width + srcX) * 4;
    return [
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
        imageData.data[idx + 3]
    ];
};

const applyConvolutionToChannel = (
    imageData: ImageData,
    kernel: number[][],
    kernelSize: number,
    divisor: number,
    offset: number,
    strategy: EdgeHandlingStrategy,
    channelIndex: 0 | 1 | 2 | 3
): Uint8ClampedArray => {
    const width = imageData.width;
    const height = imageData.height;
    const result = new Uint8ClampedArray(width * height);
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            
            for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                    const [r, g, b, a] = getPixelWithEdgeHandling(imageData, x + kx, y + ky, strategy);
                    let value: number;
                    
                    switch (channelIndex) {
                        case 0: value = r; break;
                        case 1: value = g; break;
                        case 2: value = b; break;
                        default: value = a; break;
                    }
                    
                    const kernelValue = kernel[ky + halfKernel][kx + halfKernel];
                    sum += value * kernelValue;
                }
            }
            
            let newValue = sum / divisor + offset;
            newValue = Math.min(255, Math.max(0, Math.round(newValue)));
            result[y * width + x] = newValue;
        }
    }
    
    return result;
};

export const applyConvolutionAsync = async (
    imageData: ImageData,
    kernel: Kernel,
    strategy: EdgeHandlingStrategy,
    applyToChannels: { red: boolean; green: boolean; blue: boolean; alpha: boolean },
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
): Promise<ImageData> => {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);
    
    const divisor = kernel.divisor || 1;
    const offset = kernel.offset || 0;
    const kernelSize = kernel.matrix.length;
    
    const channelsToProcess: (0 | 1 | 2 | 3)[] = [];
    if (applyToChannels.red) channelsToProcess.push(0);
    if (applyToChannels.green) channelsToProcess.push(1);
    if (applyToChannels.blue) channelsToProcess.push(2);
    if (applyToChannels.alpha) channelsToProcess.push(3);
    
    if (channelsToProcess.length === 0) {
        result.data.set(imageData.data);
        return result;
    }
    
    result.data.set(imageData.data);
    
    for (let i = 0; i < channelsToProcess.length; i++) {
        if (signal?.aborted) {
            throw new Error('Операция отменена');
        }
        
        const channel = channelsToProcess[i];
        const processedChannel = applyConvolutionToChannel(
            imageData,
            kernel.matrix,
            kernelSize,
            divisor,
            offset,
            strategy,
            channel
        );
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                result.data[idx + channel] = processedChannel[y * width + x];
            }
        }
        
        if (onProgress) {
            onProgress(((i + 1) / channelsToProcess.length) * 100);
        }
        
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return result;
};

export const applyConvolutionSync = (
    imageData: ImageData,
    kernel: Kernel,
    strategy: EdgeHandlingStrategy,
    applyToChannels: { red: boolean; green: boolean; blue: boolean; alpha: boolean }
): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const result = new ImageData(width, height);
    
    const divisor = kernel.divisor || 1;
    const offset = kernel.offset || 0;
    const kernelSize = kernel.matrix.length;
    
    result.data.set(imageData.data);
    
    const channelsToProcess: (0 | 1 | 2 | 3)[] = [];
    if (applyToChannels.red) channelsToProcess.push(0);
    if (applyToChannels.green) channelsToProcess.push(1);
    if (applyToChannels.blue) channelsToProcess.push(2);
    if (applyToChannels.alpha) channelsToProcess.push(3);
    
    for (const channel of channelsToProcess) {
        const processedChannel = applyConvolutionToChannel(
            imageData,
            kernel.matrix,
            kernelSize,
            divisor,
            offset,
            strategy,
            channel
        );
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                result.data[idx + channel] = processedChannel[y * width + x];
            }
        }
    }
    
    return result;
};

export const kernelToFlatArray = (kernel: Kernel): number[] => {
    const flat: number[] = [];
    for (let i = 0; i < kernel.matrix.length; i++) {
        for (let j = 0; j < kernel.matrix[i].length; j++) {
            flat.push(kernel.matrix[i][j]);
        }
    }
    return flat;
};

export const flatArrayToKernel = (
    name: string,
    values: number[],
    size: number = 3,
    divisor?: number,
    offset?: number
): Kernel => {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
        matrix.push(values.slice(i * size, (i + 1) * size));
    }
    return {
        name,
        matrix,
        divisor,
        offset
    };
};