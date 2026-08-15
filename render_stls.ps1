$openscad = "C:\Program Files\OpenSCAD\openscad.exe"
$outdir = "c:\Users\Felip\OneDrive\Documentos\ATY HUB BET\pecas_impressao"
$src = "c:\Users\Felip\OneDrive\Documentos\ATY HUB BET"

if (!(Test-Path $outdir)) {
    New-Item -ItemType Directory -Path $outdir | Out-Null
    Write-Host "Pasta criada: $outdir"
}

Write-Host "=== INICIANDO EXPORTACAO DE STLs NO OPENSCAD ==="

$pezas = @(
    @("base_inferior_frontal.scad", "base_inferior_frontal.stl"),
    @("base_inferior_traseira.scad", "base_inferior_traseira.stl"),
    @("tampa_superior_frontal.scad", "tampa_superior_frontal.stl"),
    @("tampa_superior_traseira.scad", "tampa_superior_traseira.stl"),
    @("carrinho_central_x.scad", "carrinho_central_x.stl"),
    @("carrinho_lateral_y_esquerdo.scad", "carrinho_lateral_y_esquerdo.stl"),
    @("carrinho_lateral_y_direito.scad", "carrinho_lateral_y_direito.stl"),
    @("ponte_movel_x.scad", "ponte_movel_x.stl"),
    @("acessorio_dedal.scad", "acessorio_dedal.stl"),
    @("eixo_y_barra_frontal.scad", "eixo_y_barra_frontal.stl"),
    @("eixo_y_barra_traseira.scad", "eixo_y_barra_traseira.stl"),
    @("eixo_x_barra.scad", "eixo_x_barra.stl"),
    @("pinos_encaixe_tampa.scad", "pinos_encaixe_tampa.stl")
)

$i = 1
foreach ($p in $pezas) {
    $scad = Join-Path $src $p[0]
    $stl = Join-Path $outdir $p[1]
    
    Write-Host "[$i/13] Renderizando: $($p[0]) -> $($p[1])..."
    
    if (Test-Path $scad) {
        $start = Get-Date
        # Executa o OpenSCAD
        Start-Process -FilePath $openscad -ArgumentList "-o `"$stl`" `"$scad`"" -NoNewWindow -Wait
        $elapsed = ((Get-Date) - $start).TotalSeconds
        Write-Host "  ✅ Concluido! (Tempo: $($elapsed.ToString('F1'))s)"
    } else {
        Write-Host "  ❌ Erro: $($p[0]) nao encontrado!"
    }
    $i++
}

Write-Host "============================================="
Write-Host "Processo concluido! Todos os STLs estao em:"
Write-Host $outdir
Write-Host "============================================="
