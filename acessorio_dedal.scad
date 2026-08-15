/* ==========================================================================
   PROJETO CAMPO TÁTIL - ACESSÓRIO BOTAO MAGNÉTICO (ESTILO TAMPA DE GARRAFA)
   Design de perfil baixo com rebaixo para dedo no topo e ímã na base.
   ========================================================================== */

$fn = 80;

// Parâmetros do Botão
diametro_externo = 26.0;   // Diâmetro total do botão
altura_total = 6.0;        // Perfil ultra-baixo
dedo_rebaixo_d = 20.0;     // Diâmetro do berço do dedo
dedo_rebaixo_h = 1.8;      // Altura da borda pequena de relevo

// Parâmetros do Ímã e Teflon
ima_d = 12.2;              // Ímã de 12mm (com folga de 0.2mm)
ima_h = 3.2;               // Espessura do Ímã de 3mm (com folga de 0.2mm)
teflon_prof = 0.5;         // Rebaixo inferior para fita de Teflon

module botao_magnetico() {
    difference() {
        // 1. Corpo principal com chanfro na borda externa superior
        union() {
            // Cilindro base inferior
            cylinder(h = altura_total - 1.5, r = diametro_externo/2);
            // Cone de chanfro superior (reduz o raio de 13mm para 11.5mm no topo)
            translate([0, 0, altura_total - 1.5])
                cylinder(h = 1.5, r1 = diametro_externo/2, r2 = (diametro_externo - 3.0)/2);
        }
        
        // 2. Rebaixo para o dedo no topo (deixa uma borda fina de 1.8mm de altura e 3mm de parede)
        translate([0, 0, altura_total - dedo_rebaixo_h])
            cylinder(h = dedo_rebaixo_h + 0.1, r = dedo_rebaixo_d/2);
            
        // 3. Alojamento do Ímã Neodímio 12x3mm por baixo (profundidade de 3.2mm)
        // Isso deixa uma parede sólida de exatamente 1.0mm no meio do botão (Z=3.2 até Z=4.2)
        translate([0, 0, -0.1])
            cylinder(h = ima_h, r = ima_d/2);
            
        // 4. Rebaixo circular na base para Fita de Teflon (PTFE)
        // Largura do anel: de raio 6.6mm até 12.0mm
        translate([0, 0, -0.1])
            difference() {
                cylinder(h = teflon_prof + 0.1, r = diametro_externo/2 - 1.0);
                cylinder(h = teflon_prof + 0.2, r = ima_d/2 + 0.5); // Preserva o colar ao redor do ímã
            }
    }
}

botao_magnetico();
