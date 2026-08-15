import os
import subprocess
import time

# Caminho do executável do OpenSCAD
openscad_path = r"C:\Program Files\OpenSCAD\openscad.exe"

# Pasta de destino para os arquivos STL
output_dir = r"c:\Users\Felip\OneDrive\Documentos\ATY HUB BET\pecas_impressao"
source_dir = r"c:\Users\Felip\OneDrive\Documentos\ATY HUB BET"

# Lista de peças a serem renderizadas: (arquivo_origem_scad, arquivo_destino_stl)
pezas_para_renderizar = [
    ("base_inferior_frontal.scad", "base_inferior_frontal.stl"),
    ("base_inferior_traseira.scad", "base_inferior_traseira.stl"),
    ("tampa_superior_frontal.scad", "tampa_superior_frontal.stl"),
    ("tampa_superior_traseira.scad", "tampa_superior_traseira.stl"),
    ("carrinho_central_x.scad", "carrinho_central_x.stl"),
    ("carrinho_lateral_y_esquerdo.scad", "carrinho_lateral_y_esquerdo.stl"),
    ("carrinho_lateral_y_direito.scad", "carrinho_lateral_y_direito.stl"),
    ("ponte_movel_x.scad", "ponte_movel_x.stl"),
    ("acessorio_dedal.scad", "acessorio_dedal.stl")
]

def main():
    print("=== INICIANDO RENDERIZAÇÃO AUTOMÁTICA DE STLs ===")
    
    # 1. Cria a pasta se não existir
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Pasta criada: {output_dir}\n")
    else:
        print(f"Pasta destino existente: {output_dir}\n")
        
    start_time_total = time.time()
    
    # 2. Renderiza cada peça
    for i, (scad_file, stl_file) in enumerate(pezas_para_renderizar, 1):
        scad_path = os.path.join(source_dir, scad_file)
        stl_path = os.path.join(output_dir, stl_file)
        
        print(f"[{i}/{len(pezas_para_renderizar)}] Renderizando: {scad_file} -> {stl_file}...")
        
        if not os.path.exists(scad_path):
            print(f"  ❌ Erro: Arquivo {scad_file} não encontrado na pasta de origem!")
            continue
            
        start_time_part = time.time()
        
        # Executa o comando em segundo plano
        cmd = [openscad_path, "-o", stl_path, scad_path]
        try:
            # Roda o OpenSCAD em segundo plano e aguarda
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            elapsed_part = time.time() - start_time_part
            print(f"  ✅ Concluído com sucesso! (Tempo: {elapsed_part:.1f}s)")
        except subprocess.CalledProcessError as e:
            print(f"  ❌ Erro ao renderizar {scad_file}:")
            print(e.stderr)
        except Exception as ex:
            print(f"  ❌ Erro inesperado: {ex}")
            
    elapsed_total = time.time() - start_time_total
    print("\n==================================================")
    print(f"Processo Concluído! Todos os STLs salvos em:\n{output_dir}")
    print(f"Tempo total decorrido: {elapsed_total/60:.1f} minutos.")
    print("==================================================")

if __name__ == "__main__":
    main()
