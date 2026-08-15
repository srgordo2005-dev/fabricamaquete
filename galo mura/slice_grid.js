const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const gridImagePath = 'C:\\Users\\Felip\\.gemini\\antigravity\\brain\\696c3fba-e595-4db0-b6ef-97cded0607be\\media__1783989641791.jpg';
const destDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 20 Plumage names matching the 4x5 grid layout
const names = [
  ['Carijó', 'Caboclo', 'Prata', 'Tostado', 'Branco'],
  ['Muleto', 'Laranja', 'Ruano', 'Capa Amarela', 'Pratinha'],
  ['Gis', 'Abóbora', 'Cinza', 'Prata Escuro', 'Barroso'],
  ['Roxo', 'Preto-e-Branco', 'Capa Vermelha', 'Amarelo', 'Salmão']
];

async function processGrid() {
  try {
    console.log('Carregando imagem do grid...');
    const image = await Jimp.read(gridImagePath);
    
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    console.log(`Dimensões do grid: ${width}x${height}px`);
    
    const cols = 5;
    const rows = 4;
    
    const cellW = Math.floor(width / cols);
    const cellH = Math.floor(height / rows);
    
    console.log(`Fatiando em células de ${cellW}x${cellH}px...`);
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = names[r][c];
        const x = c * cellW;
        const y = r * cellH;
        
        console.log(`Processando: [${name}] em x:${x}, y:${y}`);
        
        // Clone and crop cell
        const cell = image.clone().crop({ x, y, w: cellW, h: cellH });
        
        // Background removal logic
        removeBackground(cell);
        
        // Save
        const filename = `${name}.png`;
        const filepath = path.join(destDir, filename);
        await cell.write(filepath);
        console.log(`Salvo: public/images/${filename}`);
      }
    }
    
    console.log('🎉 Faturamento e remoção de fundo concluídos com sucesso!');
  } catch (err) {
    console.error('Erro ao processar grid:', err);
  }
}

// Removes light background pixels with tolerance
function removeBackground(image) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;
  
  // Sample background color from top-left (x=10, y=10)
  const bgIdx = (10 * width + 10) * 4;
  const bg = {
    r: data[bgIdx],
    g: data[bgIdx + 1],
    b: data[bgIdx + 2]
  };
  
  const tolerance = 50; // Tolerance for background color similarity
  
  // Replace matching pixels with transparent ones
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Calculate distance to background color
      const dist = Math.sqrt(
        Math.pow(r - bg.r, 2) +
        Math.pow(g - bg.g, 2) +
        Math.pow(b - bg.b, 2)
      );
      
      // Filter out top-left numbers like "1", "2"
      const isTopLeftNumber = x < 45 && y < 30;
      
      // Also clear edge pixels to remove grid borders
      const isEdge = x < 4 || x > width - 4 || y < 4 || y > height - 4;
      
      if (dist < tolerance || isTopLeftNumber || isEdge) {
        data[idx + 3] = 0; // Set alpha to 0 (Transparent)
      }
    }
  }
  
  // Autocrop transparent margins to center the rooster
  image.autocrop();
}

processGrid();
