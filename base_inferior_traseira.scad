/* ==========================================================================
   PROJETO CAMPO TÁTIL - GABINETE INFERIOR (METADE TRASEIRA / FUNDO - 175x175mm)
   Contém o rebaixo meia-madeira (Lap Joint) fêmea e furos de conectores traseiros
   Pronto para fatiar direto na Bambu Lab A1 Mini (Suporte Zero)
   ========================================================================== */

largura_total = 175;      
comprimento_total = 350;  
altura_total = 60;        
parede = 2.5;             
eixo_quadrado_w = 10.2;   
altura_berco = 20.5;

pos_x_eixo_y = 175/2 - 10.5; // x = 77.0mm

$fn = 60;

// Apoio de Tampa (Bosses)
module apoio_tampa(lado_esquerdo=true) {
    desloc_x = lado_esquerdo ? -(largura_total/2 - parede) : (largura_total/2 - parede);
    translate([desloc_x + (lado_esquerdo ? 2.5 : -2.5), 0, 0]) {
        difference() {
            cylinder(h = 10, r = 5.0, center=true);
            cylinder(h = 12, r = 1.5, center=true); // Furo M3
        }
    }
}

// Suporte das hastes prateadas Y (Berço U)
module berco_u() {
    difference() {
        translate([0, 0, 31/2]) cube([14, 10, 31], center=true);
        translate([0, 0, altura_berco + 10]) cube([eixo_quadrado_w, 12, 20], center=true);
    }
}

// Máscara de corte do encaixe meia-madeira (Lap Joint)
module mascara_corte_frontal() {
    union() {
        // Corta tudo antes de Y=0
        translate([0, -comprimento_total/2, altura_total/2])
            cube([largura_total + 10, comprimento_total, altura_total + 10], center=true);
            
        // Degrau inferior do piso de união (Z de 0 a 1.25mm, Y avança 3mm para a frente)
        translate([0, 1.5, 1.25/2])
            cube([largura_total, 3.0, 1.25], center=true);
            
        // Degrau interno da parede lateral esquerda (x de -87.5 a -86.25mm)
        translate([-(largura_total - 1.25)/2, 1.5, altura_total/2])
            cube([1.25, 3.0, altura_total], center=true);
            
        // Degrau interno da parede lateral direita (x de 86.25 a 87.5mm)
        translate([(largura_total - 1.25)/2, 1.5, altura_total/2])
            cube([1.25, 3.0, altura_total], center=true);
    }
}

// Carcaça base completa
module carcaca_base_completa() {
    difference() {
        union() {
            // Gabinete externo liso
            difference() {
                translate([0, 0, altura_total/2])
                    cube([largura_total, comprimento_total, altura_total], center=true);
                translate([0, 0, (altura_total - parede)/2 + parede])
                    cube([largura_total - parede*2, comprimento_total - parede*2, altura_total - parede + 0.1], center=true);
            }
            
            // Apoios de Tampa (Bosses)
            // Apoios frontais
            translate([0, -comprimento_total/2 + parede + 4, altura_total - 5]) {
                apoio_tampa(lado_esquerdo=true);
                apoio_tampa(lado_esquerdo=false);
            }
            // Apoios meio-frente
            translate([0, -5.0, altura_total - 5]) {
                apoio_tampa(lado_esquerdo=true);
                apoio_tampa(lado_esquerdo=false);
            }
            // Apoios meio-trás
            translate([0, 5.0, altura_total - 5]) {
                apoio_tampa(lado_esquerdo=true);
                apoio_tampa(lado_esquerdo=false);
            }
            // Apoios traseiros
            translate([0, comprimento_total/2 - parede - 4, altura_total - 5]) {
                apoio_tampa(lado_esquerdo=true);
                apoio_tampa(lado_esquerdo=false);
            }
            
            // Suportes em U nos 4 cantos para as hastes Y
            translate([-pos_x_eixo_y, comprimento_total/2 - parede - 5, 0]) berco_u();
            translate([-pos_x_eixo_y, -comprimento_total/2 + parede + 5, 0]) berco_u();
            translate([pos_x_eixo_y, comprimento_total/2 - parede - 5, 0]) berco_u();
            translate([pos_x_eixo_y, -comprimento_total/2 + parede + 5, 0]) berco_u();
        }
        
        // Furos traseiros de conectores
        translate([38, comprimento_total/2, parede + 11/2 + 2]) cube([24, parede*3, 11], center=true); 
        translate([-40, comprimento_total/2, parede + 4.5/2 + 1]) cube([10, parede*3, 4.5], center=true); 
        translate([-54, comprimento_total/2, parede + 3.5 + 1]) rotate([90, 0, 0]) cylinder(h = parede*3, r = 3.5, center=true); 
    }
    
    // Cremalheira Y do chão
    translate([0, 0, 5/2 + parede])
        cube([2.0, comprimento_total - parede*2, 5.0], center=true);
    for (y = [-comprimento_total/2 + parede : 2.0 : comprimento_total/2 - parede - 2]) {
        translate([-1.5, y, 5/2 + parede])
            cube([1.0, 1.2, 5.0], center=true);
    }
}

// RENDERIZA APENAS A METADE TRASEIRA (Deslocada para o centro de impressão)
translate([0, -comprimento_total/4, 0])
    difference() {
        carcaca_base_completa();
        mascara_corte_frontal();
    }
