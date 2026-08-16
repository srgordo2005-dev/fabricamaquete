/* ==========================================================================
   PROJETO CAMPO TÁTIL - CREMALHEIRA DE ENCAIXE EIXO X (PARA BARRA 10x10)
   Abraça a barra quadrada de 10x10mm da ponte e tem os dentes GT2 integrados
   ========================================================================== */

$fn = 60;

comprimento_ponte = 110;  // Comprimento útil da cremalheira
eixo_quadrado_w = 10.2;   // Encaixe justo na barra (10mm + 0.2mm)
parede = 2.0;             // Espessura da parede da canaleta

// Módulo para gerar dentes GT2 de 2.0mm de passo (voltados para a esquerda)
module dente_vertical_gt2_2mm(altura_dente=1.0, espessura_parede=2.0) {
    polygon(points=[
        [0, 0], 
        [0.4, -altura_dente], 
        [1.6, -altura_dente], 
        [2.0, 0],
        [2.0, espessura_parede],
        [0, espessura_parede]
    ]);
}

module cremalheira_x() {
    difference() {
        // 1. Corpo externo da canaleta (U de encaixe)
        translate([0, 0, (eixo_quadrado_w + parede)/2])
            cube([eixo_quadrado_w + parede*2, comprimento_ponte, eixo_quadrado_w + parede], center=true);
        
        // 2. Recorte interno quadrado de 10.2mm (Deixa a parte superior aberta para abraçar o metal)
        translate([0, 0, eixo_quadrado_w/2 + parede + 0.1])
            cube([eixo_quadrado_w, comprimento_ponte + 2, eixo_quadrado_w + 0.2], center=true);
    }
    
    // 3. Extensão da Cremalheira para alcançar o pinhão do motor X (X = -23.0mm)
    translate([-15.05, 0, (eixo_quadrado_w + parede)/2])
        cube([15.9, comprimento_ponte, eixo_quadrado_w + parede], center=true);
        
    // 4. Dentes da Cremalheira GT2 posicionados na face esquerda (X = -23.0)
    translate([-23.0, -comprimento_ponte/2, 0]) {
        linear_extrude(height=eixo_quadrado_w + parede) {
            union() {
                // Trilho base da parede de dentes
                translate([0, 0])
                    square([2.0, comprimento_ponte]);
                // Distribuição dos dentes GT2 passo 2.0mm
                for (y = [0 : 2.0 : comprimento_ponte - 2]) {
                    translate([0, y])
                        dente_vertical_gt2_2mm(altura_dente=1.2, espessura_parede=2.0);
                }
            }
        }
    }
}

cremalheira_x();
