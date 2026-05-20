export type InterpolationMethod = 'nearest-neighbor' | 'bilinear';

export const nearestNeighborInterpolation = (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
): ImageData => {
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    const srcData = imageData.data;
    
    const result = new ImageData(targetWidth, targetHeight);
    const dstData = result.data;
    
    const xRatio = srcWidth / targetWidth;
    const yRatio = srcHeight / targetHeight;
    
    for (let y = 0; y < targetHeight; y++) {
        const srcY = Math.floor(y * yRatio);
        const srcYIndex = srcY * srcWidth;
        
        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor(x * xRatio);
            const srcIndex = (srcYIndex + srcX) * 4;
            const dstIndex = (y * targetWidth + x) * 4;
            
            dstData[dstIndex] = srcData[srcIndex];
            dstData[dstIndex + 1] = srcData[srcIndex + 1];
            dstData[dstIndex + 2] = srcData[srcIndex + 2];
            dstData[dstIndex + 3] = srcData[srcIndex + 3];
        }
    }
    
    return result;
};

export const bilinearInterpolation = (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
): ImageData => {
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    const srcData = imageData.data;
    
    const result = new ImageData(targetWidth, targetHeight);
    const dstData = result.data;
    
    const xRatio = srcWidth / targetWidth;
    const yRatio = srcHeight / targetHeight;
    
    const getPixel = (x: number, y: number): [number, number, number, number] => {
        const clampedX = Math.min(Math.max(0, x), srcWidth - 1);
        const clampedY = Math.min(Math.max(0, y), srcHeight - 1);
        const idx = (clampedY * srcWidth + clampedX) * 4;
        return [
            srcData[idx],
            srcData[idx + 1],
            srcData[idx + 2],
            srcData[idx + 3]
        ];
    };
    
    for (let y = 0; y < targetHeight; y++) {
        const srcY = y * yRatio;
        const y1 = Math.floor(srcY);
        const y2 = Math.min(y1 + 1, srcHeight - 1);
        const dy = srcY - y1;
        
        for (let x = 0; x < targetWidth; x++) {
            const srcX = x * xRatio;
            const x1 = Math.floor(srcX);
            const x2 = Math.min(x1 + 1, srcWidth - 1);
            const dx = srcX - x1;
            
            const [r11, g11, b11, a11] = getPixel(x1, y1);
            const [r21, g21, b21, a21] = getPixel(x2, y1);
            const [r12, g12, b12, a12] = getPixel(x1, y2);
            const [r22, g22, b22, a22] = getPixel(x2, y2);
            
            const rTop = r11 * (1 - dx) + r21 * dx;
            const gTop = g11 * (1 - dx) + g21 * dx;
            const bTop = b11 * (1 - dx) + b21 * dx;
            const aTop = a11 * (1 - dx) + a21 * dx;
            
            const rBottom = r12 * (1 - dx) + r22 * dx;
            const gBottom = g12 * (1 - dx) + g22 * dx;
            const bBottom = b12 * (1 - dx) + b22 * dx;
            const aBottom = a12 * (1 - dx) + a22 * dx;
            
            const r = rTop * (1 - dy) + rBottom * dy;
            const g = gTop * (1 - dy) + gBottom * dy;
            const b = bTop * (1 - dy) + bBottom * dy;
            const a = aTop * (1 - dy) + aBottom * dy;
            
            const dstIndex = (y * targetWidth + x) * 4;
            dstData[dstIndex] = Math.min(255, Math.max(0, Math.round(r)));
            dstData[dstIndex + 1] = Math.min(255, Math.max(0, Math.round(g)));
            dstData[dstIndex + 2] = Math.min(255, Math.max(0, Math.round(b)));
            dstData[dstIndex + 3] = Math.min(255, Math.max(0, Math.round(a)));
        }
    }
    
    return result;
};

export const scaleImage = (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    method: InterpolationMethod = 'bilinear'
): ImageData => {
    if (targetWidth <= 0 || targetHeight <= 0) {
        throw new Error('Размеры должны быть положительными');
    }
    
    if (method === 'nearest-neighbor') {
        return nearestNeighborInterpolation(imageData, targetWidth, targetHeight);
    } else {
        return bilinearInterpolation(imageData, targetWidth, targetHeight);
    }
};

export const convertToGrayscale = (imageData: ImageData): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const srcPixels = imageData.data;
    const result = new ImageData(width, height);
    const dstPixels = result.data;
    
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const gray = Math.round(
            0.299 * srcPixels[idx] + 
            0.587 * srcPixels[idx + 1] + 
            0.114 * srcPixels[idx + 2]
        );
        dstPixels[idx] = gray;
        dstPixels[idx + 1] = gray;
        dstPixels[idx + 2] = gray;
        dstPixels[idx + 3] = srcPixels[idx + 3];
    }
    
    return result;
};

export const interpolationDescriptions: Record<InterpolationMethod, { title: string; description: string; pros: string[] }> = {
    'nearest-neighbor': {
        title: 'Ближайший сосед (Nearest Neighbor)',
        description: 'Выбирает цвет ближайшего пикселя из исходного изображения без усреднения.',
        pros: [
            'Максимальная скорость выполнения',
            'Сохраняет резкие края',
            'Подходит для пиксельной графики',
            'Не создает новых цветов'
        ]
    },
    'bilinear': {
        title: 'Билинейная интерполяция (Bilinear)',
        description: 'Усредняет цвета 4 ближайших пикселей для получения плавного перехода.',
        pros: [
            'Плавное масштабирование без пикселизации',
            'Хорошее качество для фотографий',
            'Сбалансированная производительность',
            'Минимальные артефакты'
        ]
    }
};