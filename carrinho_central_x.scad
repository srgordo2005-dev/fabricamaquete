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
                
                // Suporte do Motor X Esquerdo Plano & Embutido (x = -21.5mm)
                // Furo recuado para Y = -26.2mm seguro. Embutido sob o bloco até Y = -8.0mm
                translate([-21.5, 0, 7.55 + 2.0]) {
                    difference() {
                        hull() {
                            translate([0, -8.0, 0])
                                cube([10, 0.1, 4.0], center=true);
                            translate([0, -26.2, 0])
                                cylinder(h = 4.0, r = 3.5, center=true);
                        }
                        translate([0, -26.2, 0])
                            cylinder(h = 5.0, r = furo_m3/2, center=true);
                    }
                }

                // Suporte do Motor X Direito Plano & Embutido (x = 21.5mm)
                translate([21.5, 0, 7.55 + 2.0]) {
                    difference() {
                        hull() {
                            translate([0, -8.0, 0])
                                cube([10, 0.1, 4.0], center=true);
                            translate([0, -26.2, 0])
                                cylinder(h = 4.0, r = 3.5, center=true);
                        }
                        translate([0, -26.2, 0])
                            cylinder(h = 5.0, r = furo_m3/2, center=true);
                    }
                }
            }
            
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
