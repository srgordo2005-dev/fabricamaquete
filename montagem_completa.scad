/* ==========================================================================
   PROJETO CAMPO TÁTIL - MONTAGEM PARCIAL (CARRINHO Y COM SUPORTE EM U TOTALMENTE ABERTO)
   Canal em U Aberto por Cima E por Dentro (Sem Colisão com a Cremalheira)
   ========================================================================== */

$fn = 60;

/* [Controles de Movimento] */
// Arraste para mover o Carrinho Vermelho (Esquerda/Direita)
pos_x_carrinho = 15; // [-46:1:46]

// Arraste para mover a Ponte Móvel (Frente/Trás)
pos_y_ponte = 30; // [-145:1:145]

/* [Parâmetros Físicos] */
largura_total = 175;      // X (Largura Máxima: 175mm)
comprimento_total = 350;  // Y (Comprimento Duplicado: 350mm)
altura_total = 60;        
parede = 2.5;             
eixo_quadrado_w = 10.2;   
altura_berco = 20.5;
furo_m3 = 3.4;
furo_distancia_oficial = 43.0; 

// Eixos lineares Y afastados para a nova largura de 175mm
pos_x_eixo_y = 175/2 - 10.5; // x = 77.0mm

// Módulo para gerar dentes GT2 de 2.0mm de passo
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

// 1. CARCAÇA BASE SPLIT (175x350x60mm)
module berco_u() {
    difference() {
        translate([0, 0, 31/2]) cube([14, 10, 31], center=true);
        translate([0, 0, altura_berco + 10]) cube([eixo_quadrado_w, 12, 20], center=true);
    }
}

module base_gabinete_completa_modelo() {
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
                translate([-(largura_total/2 - parede) + 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
                translate([(largura_total/2 - parede) - 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
            }
            // Apoios meio-frente
            translate([0, -5.0, altura_total - 5]) {
                translate([-(largura_total/2 - parede) + 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
                translate([(largura_total/2 - parede) - 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
            }
            // Apoios meio-trás
            translate([0, 5.0, altura_total - 5]) {
                translate([-(largura_total/2 - parede) + 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
                translate([(largura_total/2 - parede) - 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
            }
            // Apoios traseiros
            translate([0, comprimento_total/2 - parede - 4, altura_total - 5]) {
                translate([-(largura_total/2 - parede) + 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
                translate([(largura_total/2 - parede) - 2.5, 0, 0]) cylinder(h=10, r=5.0, center=true);
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

module base_gabinete_montagem() {
    color("gold") intersection() {
        base_gabinete_completa_modelo();
        mascara_corte_frontal();
    }
    color("darkkhaki") difference() {
        base_gabinete_completa_modelo();
        mascara_corte_frontal();
    }
}

// 2. BARRAS GUIA Y ALONGADAS (10x10x345mm)
module barra_quadrada_y_montagem() {
    color("silver")
        translate([0, 0, 5])
            cube([10, 345, 10], center=true);
}

// 3. CARRINHO LATERAL Y COM SUPORTE EM U ABERTO PARA DENTRO E PARA CIMA
module carrinho_lateral_y_montagem(braco_interno_esquerdo=false) {
    desloc_x_centro_braco = braco_interno_esquerdo ? 9.375 : -9.375;
    
    difference() {
        union() {
            // Corpo principal original de 24mm em Y (spans Y = -12 a 12mm)
            translate([0, 0, 24/2]) cube([14, 24, 24], center=true);
            
            // Prolongador interno (total 10.0mm de altura)
            translate([desloc_x_centro_braco, -17.25, 1.05])
                cube([8.25, 10.5, 10.0], center=true);
                
            // Nervura triangular de reforço em X-Y (Mão-Francesa lateral)
            translate([0, 0, 1.05]) {
                linear_extrude(height = 10.0, center = true) {
                    if (braco_interno_esquerdo) {
                        polygon(points = [
                            [7.0, -12.0],
                            [7.0, -17.5],
                            [13.5, -17.5]
                        ]);
                    } else {
                        polygon(points = [
                            [-7.0, -12.0],
                            [-7.0, -17.5],
                            [-13.5, -17.5]
                        ]);
                    }
                }
            }
        }
        // Canal do Eixo Y
        translate([0, 0, 1.5 + 10.3/2]) cube([10.3, 26, 10.3], center=true);
        
        // Eixo Único da Ponte X (Y = 0mm)
        translate([0, 0, 13.5 + 10.1/2]) cube([16, 10.1, 10.1], center=true);
        
        // Corte do encaixe: Remove a parede do lado interno (abre para o centro do campo e para cima)
        // Para o esquerdo, o corte vai de X = 6.4mm em diante (+X)
        // Para o direito, o corte vai de X = -6.4mm para trás (-X)
        if (braco_interno_esquerdo) {
            translate([10.7, -17.5, 3.0])
                cube([8.6, 10.2, 10.0], center=true);
        } else {
            translate([-10.7, -17.5, 3.0])
                cube([8.6, 10.2, 10.0], center=true);
        }
    }
}

// 4. PONTE X ALONGADA
module ponte_movel_x_montagem() {
    color("silver")
        translate([0, 0, 13.5 + 10.1/2])
            cube([164, 10, 10], center=true);
    
    // Cremalheira X
    color("teal") {
        union() {
            translate([0, -17.5, 0.55])
                cube([141.0, 10, 5], center=true);
            
            // Colunas de Fixação do motor Y
            translate([-21.0, -14.5, (0.55 - 9.0)/2])
                cube([7, 6, 0.55 + 9.0], center=true);
            translate([-21.0, -8.5, -9.0 + 1.5]) {
                difference() {
                    cylinder(h = 3, r = 3.5, center=true);
                    cylinder(h = 4, r = furo_m3/2, center=true);
                }
            }

            translate([5.0, -14.5, (0.55 - 9.0)/2])
                cube([7, 6, 0.55 + 9.0], center=true);
            translate([5.0, -8.5, -9.0 + 1.5]) {
                difference() {
                    cylinder(h = 3, r = 3.5, center=true);
                    cylinder(h = 4, r = furo_m3/2, center=true);
                }
            }
        }
        
        // Dentes da Cremalheira X
        for (x = [-67.5 : 2.0 : 67.5]) {
            translate([x, -23.0, 0.55])
                cube([1.2, 1.0, 5.0], center=true);
        }
    }
}

// 5. CARRINHO CENTRAL X
module carrinho_central_x_montagem() {
    difference() {
        union() {
            // Bloco principal original (Z relativo = 11.55 a 25.55mm, Y = 24mm)
            translate([0, 0, 13.5 + 10.1/2])
                cube([48, 24, 14], center=true);
                
            // TORRE DE ELEVAÇÃO DO ÍMÃ (Z absoluto = 59.5mm)
            translate([0, 0, 25.55 + 5.0])
                cylinder(h = 10.0, r = 8.0, center=true);
                
            translate([0, 0, 38.0]) {
                difference() {
                    cylinder(h = 5.0, r = 8.0, center=true); 
                    cylinder(h = 6.0, r = 6.1, center=true); 
                }
            }
            
            // NOVO SUPORTE UNIFICADO E RIGIDO PARA MOTOR NEMA 14 (36mm)
            // Estende-se de Y = -12 (face do carrinho) até Y = -44 (espessura de 3mm)
            translate([0, -28.0, 7.55 + 1.5]) {
                cube([38, 32, 3.0], center=true);
            }
            
            // Abas de reforço laterais (Gussets) para evitar flexão do suporte
            // Triângulos ligando as laterais do suporte ao corpo do carrinho
            translate([-17.5, -12.0, 7.55 + 3.0]) {
                rotate([90, 0, 90]) {
                    linear_extrude(height = 3) {
                        polygon(points=[[0,0], [12,0], [0,8]]);
                    }
                }
            }
            translate([14.5, -12.0, 7.55 + 3.0]) {
                rotate([90, 0, 90]) {
                    linear_extrude(height = 3) {
                        polygon(points=[[0,0], [12,0], [0,8]]);
                    }
                }
            }
        }
        
        // Canal de deslize 1 (Eixo Único - Y = 0mm) - 100% FECHADO E ÍNTEGRO
        translate([0, 0, 13.5 + 10.1/2])
            cube([50, 10.3, 10.3], center=true);
            
        // Furo central do colar do NEMA 14 (23mm de diâmetro) para assentar plano
        translate([0, -29.4, 7.55 + 1.5])
            cylinder(h = 10, r = 11.5, center=true);
            
        // Furos de fixação M3 para o motor NEMA 14 (Espaçamento 26mm x 26mm)
        for (x = [-13, 13]) {
            for (y = [-13, 13]) {
                translate([x, -29.4 + y, 7.55 + 1.5])
                    cylinder(h = 10, r = furo_m3/2, center=true);
            }
        } 
    }
}

// ================= RENDERIZAR A MONTAGEM COMPLETA =================
module executar_montagem() {
    base_gabinete_montagem();
    
    // Hastes Y Alongadas
    translate([-pos_x_eixo_y, 0, 20.5]) barra_quadrada_y_montagem();
    translate([pos_x_eixo_y, 0, 20.5]) barra_quadrada_y_montagem();
    
    // Carrinho Y Esquerdo
    translate([-pos_x_eixo_y, pos_y_ponte, 19.0])
        color("darkorange")
            carrinho_lateral_y_montagem(braco_interno_esquerdo=true);
            
    // Carrinho Y Direito
    translate([pos_x_eixo_y, pos_y_ponte, 19.0])
        color("darkorange")
            carrinho_lateral_y_montagem(braco_interno_esquerdo=false);
                
    // A Ponte X
    translate([0, pos_y_ponte, 19.0])
        color("teal")
            ponte_movel_x_montagem();
            
    // Carrinho Central X
    translate([pos_x_carrinho, pos_y_ponte, 19.0])
        color("crimson")
            carrinho_central_x_montagem();
}

executar_montagem();
