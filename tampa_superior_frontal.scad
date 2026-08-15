/* ==========================================================================
   PROJETO CAMPO TÁTIL - TAMPA SUPERIOR (METADE FRONTAL "A" - 175x175mm)
   Canaletas em Baixo-Relevo Limpas de 0.4mm (Sem sobreposição de sólidos)
   Pinos de encaixe removidos | Pronto para fatiar direto na Bambu Lab A1 Mini
   ========================================================================== */

largura_total = 175;       
comprimento_total = 350;   
espessura_campo = 5.0;     
borda_altura = 13.0;       
borda_largura = 5.0;       

$fn = 60;

// Célula Braille padrão (Pontos com 1.5mm diâmetro, 0.6mm altura)
module ponto_braille(x, y) {
    translate([x, y, espessura_campo])
        cylinder(h = 0.6, r = 0.75);
}

// Letras Braille Individuais
module letra_a(x, y) { ponto_braille(x - 1.25, y + 1.25); }
module letra_b(x, y) { ponto_braille(x - 1.25, y + 1.25); ponto_braille(x - 1.25, y); }
module letra_c(x, y) { ponto_braille(x - 1.25, y + 1.25); ponto_braille(x + 1.25, y + 1.25); }
module letra_g(x, y) { 
    ponto_braille(x - 1.25, y + 1.25); ponto_braille(x - 1.25, y); 
    ponto_braille(x + 1.25, y + 1.25); ponto_braille(x + 1.25, y); 
}
module letra_l(x, y) { ponto_braille(x - 1.25, y + 1.25); ponto_braille(x - 1.25, y); ponto_braille(x - 1.25, y - 1.25); }
module letra_n(x, y) {
    ponto_braille(x - 1.25, y + 1.25); ponto_braille(x - 1.25, y - 1.25);
    ponto_braille(x + 1.25, y + 1.25); ponto_braille(x + 1.25, y);
}
module letra_o(x, y) { ponto_braille(x - 1.25, y + 1.25); ponto_braille(x - 1.25, y - 1.25); ponto_braille(x + 1.25, y); }

// Escreve "GOL" em Braille
module palavra_braille_gol(x_pos, y_pos) {
    letra_g(x_pos - 10.0, y_pos);
    letra_o(x_pos, y_pos);
    letra_l(x_pos + 10.0, y_pos);
}

// Escreve "BANCO" (Reservas) verticalmente
module braille_banco_reservas(x_pos, y_pos) {
    letra_b(x_pos, y_pos + 24);
    letra_a(x_pos, y_pos + 12);
    letra_n(x_pos, y_pos);
    letra_c(x_pos, y_pos - 12);
    letra_o(x_pos, y_pos - 24);
}

module tampa_campo_verde() {
    difference() {
        union() {
            // 1. Placa principal do campo (piso de 5mm)
            translate([0, 0, espessura_campo/2])
                cube([largura_total, comprimento_total, espessura_campo], center=true);
            
            // 2. Barreira elevada nas bordas fechada nos 4 lados (Z vai até 13.0mm)
            translate([0, 0, borda_altura/2])
                difference() {
                    cube([largura_total, comprimento_total, borda_altura], center=true);
                    cube([largura_total - borda_largura*2, comprimento_total - borda_largura*2, borda_altura + 1], center=true);
                }
        }
        
        // 3. Canaletas em baixo-relevo de 0.4mm de profundidade (Z de 4.6 a 5.0mm)
        translate([0, 0, espessura_campo - 0.2]) {
            // Linhas laterais limitrofes de jogo
            translate([-46.0, 0, 0]) cube([2.0, 262, 0.4], center=true);
            translate([46.0, 0, 0]) cube([2.0, 262, 0.4], center=true);
            // Linhas de fundo
            translate([0, -130.0, 0]) cube([94, 2.0, 0.4], center=true);
            translate([0, 130.0, 0]) cube([94, 2.0, 0.4], center=true);
            // Linha divisória de meio de campo (y = 0)
            cube([94, 2.0, 0.4], center=true);
            // Círculo Central (Raio 15mm)
            difference() {
                cylinder(h = 0.4, r = 15, center=true);
                cylinder(h = 0.6, r = 13, center=true);
            }
            // Grande Área Frontal
            difference() {
                translate([0, -115.0, 0]) cube([50, 30, 0.4], center=true);
                translate([0, -115.0, 0]) cube([46, 26, 0.5], center=true);
            }
            // Pequena Área Frontal
            difference() {
                translate([0, -123.75, 0]) cube([30, 12.5, 0.4], center=true);
                translate([0, -123.75, 0]) cube([26, 8.5, 0.5], center=true);
            }
            // Grande Área Traseira
            difference() {
                translate([0, 115.0, 0]) cube([50, 30, 0.4], center=true);
                translate([0, 115.0, 0]) cube([46, 26, 0.5], center=true);
            }
            // Pequena Área Traseira
            difference() {
                translate([0, 123.75, 0]) cube([30, 12.5, 0.4], center=true);
                translate([0, 123.75, 0]) cube([26, 8.5, 0.5], center=true);
            }
            // Escanteios
            translate([-46.0, -130.0, 0]) difference() { cylinder(h=0.4, r=6, center=true); cylinder(h=0.6, r=4.5, center=true); }
            translate([46.0, -130.0, 0]) difference() { cylinder(h=0.4, r=6, center=true); cylinder(h=0.6, r=4.5, center=true); }
            translate([-46.0, 130.0, 0]) difference() { cylinder(h=0.4, r=6, center=true); cylinder(h=0.6, r=4.5, center=true); }
            translate([46.0, 130.0, 0]) difference() { cylinder(h=0.4, r=6, center=true); cylinder(h=0.6, r=4.5, center=true); }
        }
    }
}

// Apenas os bancos de reservas físicos ficam elevados na tampa lateral
module linhas_tateis_brancas() {
    color("lightgray") translate([0, 0, espessura_campo]) {
        translate([-68.0, -50.0, 0.5])
            difference() {
                cube([14, 60, 1.0], center=true);
                cube([10, 56, 1.2], center=true);
            }
        translate([68.0, 50.0, 0.5])
            difference() {
                cube([14, 60, 1.0], center=true);
                cube([10, 56, 1.2], center=true);
            }
    }
}

module tampa_completa_modelo() {
    union() {
        tampa_campo_verde();
        linhas_tateis_brancas();
        palavra_braille_gol(0, -145.0); 
        palavra_braille_gol(0, 145.0);  
        braille_banco_reservas(-68.0, -50.0); 
        braille_banco_reservas(68.0, 50.0);   
    }
}

// Máscara de corte do encaixe meia-madeira (Lap Joint) da tampa
module mascara_corte_tampa_frontal() {
    union() {
        // Tudo antes de Y=0
        translate([0, -comprimento_total/4, 50])
            cube([largura_total + 10, comprimento_total/2, 120], center=true);
            
        // Degrau inferior do piso de união (Z de 0 a 2.5mm, Y avança 5mm para o lado traseiro)
        translate([0, 2.5, 2.5/2])
            cube([largura_total, 5.0, 2.5], center=true);
            
        // Degrau interno da parede lateral esquerda (x de -87.5 a -85.0mm)
        translate([-(largura_total - 2.5)/2, 2.5, borda_altura/2])
            cube([2.5, 5.0, borda_altura], center=true);
            
        // Degrau interno da parede lateral direita (x de 85.0 a 87.5mm)
        translate([(largura_total - 2.5)/2, 2.5, borda_altura/2])
            cube([2.5, 5.0, borda_altura], center=true);
    }
}

// RENDERIZA A TAMPA FRONTAL DESLOCADA PARA IMPRESSÃO (Y de -175 a 0mm com degrau)
translate([0, comprimento_total/4, 0])
    intersection() {
        tampa_completa_modelo();
        mascara_corte_tampa_frontal();
    }
