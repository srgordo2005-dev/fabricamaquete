/* ==========================================================================
   PROJETO CAMPO TÁTIL - CARRINHO CENTRAL X (LARGURA 48mm COM TORRE DO ÍMÃ)
   Gera a peça individual do carrinho X vermelho de 48mm com torre do ímã
   Braços planos embutidos até Y=-8mm | Furos a Y=-26.2mm | Canal do Eixo 100% Fechado
   ========================================================================== */

$fn = 60;
furo_m3 = 3.4;

module carrinho_central_x() {
    // Translada a peça para assentar as abas inferiores de fixação na mesa (Z=0)
    translate([0, 0, -7.55]) {
        difference() {
            union() {
                // Bloco principal original (Z relativo = 11.55 a 25.55mm, Y = 24mm)
                translate([0, 0, 18.55])
                    cube([48, 24, 14], center=true);
                    
                // Torre de elevação do ímã (Z relativo = 25.55 a 35.55mm)
                translate([0, 0, 25.55 + 5.0])
                    cylinder(h = 10.0, r = 8.0, center=true);
                    
                // Borda redonda para o Ímã no topo (Z relativo = 35.55 a 40.55mm)
                translate([0, 0, 38.0]) {
                    difference() {
                        cylinder(h = 5.0, r = 8.0, center=true); 
                        cylinder(h = 6.0, r = 6.1, center=true); // Alojamento do ímã
                    }
                }
                
                // NOVO SUPORTE UNIFICADO E RIGIDO PARA MOTOR NEMA 14 REDONDO (36.5mm)
                // Furos com espaçamento de 46mm (X = -23 e X = 23), largura de 54mm e espessura de 3mm
                translate([0, -28.0, 7.55 + 1.5]) {
                    cube([54, 32, 3.0], center=true);
                }
                
                // Abas de reforço laterais (Gussets) reposicionadas para a placa de 54mm
                translate([-25.5, -12.0, 7.55 + 3.0]) {
                    rotate([90, 0, 90]) {
                        linear_extrude(height = 3) {
                            polygon(points=[[0,0], [12,0], [0,8]]);
                        }
                    }
                }
                translate([22.5, -12.0, 7.55 + 3.0]) {
                    rotate([90, 0, 90]) {
                        linear_extrude(height = 3) {
                            polygon(points=[[0,0], [12,0], [0,8]]);
                        }
                    }
                }
            }
            
            // Furo central do colar do NEMA 14 Redondo (23mm de diâmetro) para assentar plano
            translate([0, -29.4, 7.55 + 1.5])
                cylinder(h = 10, r = 11.5, center=true);
                
            // Dois furos de fixação M3 com espaçamento de 46mm para o NEMA 14 Redondo
            translate([-23.0, -29.4, 7.55 + 1.5])
                cylinder(h = 10, r = furo_m3/2, center=true);
            translate([23.0, -29.4, 7.55 + 1.5])
                cylinder(h = 10, r = furo_m3/2, center=true);
            
            // Canal de deslize 1 (Eixo Único - Y = 0mm) - 100% FECHADO E ÍNTEGRO
            translate([0, 0, 18.55])
                cube([50, 10.3, 10.3], center=true);
                
            // RECORTES DE SEGURANÇA E FOLGA PARA O MOTOR NEMA 17
            // Recorte frontal de 6.85mm de profundidade (Corta até Y = -5.15mm, face frontal do canal do eixo)
            translate([0, -12.0 + 3.425, 18.55])
                cube([33.0, 6.85, 14.5], center=true); 
        }
    }
}

// Renderiza a peça pronta para fatiar
carrinho_central_x();
