#!/bin/bash

# Script de ayuda para desplegar FoodOffice Backend
# Uso: ./scripts/deploy.sh [terraform|sam|all]

set -e

TERRAFORM_DIR="terraform"
SAM_STACK_NAME="foodoffice-backend"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

deploy_terraform() {
    print_info "Desplegando RDS con Terraform..."
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfvars" ]; then
        print_error "terraform.tfvars no encontrado. Copia terraform.tfvars.example y configura los valores."
        exit 1
    fi
    
    terraform init
    terraform plan
    read -p "¿Continuar con el despliegue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply
        print_info "Terraform desplegado exitosamente"
        print_info "Guarda los outputs: terraform output -json > ../terraform-outputs.json"
    else
        print_warn "Despliegue cancelado"
    fi
    
    cd ..
}

deploy_sam() {
    print_info "Desplegando Lambda + API Gateway con SAM..."
    
    if [ ! -f "sam-parameters.json" ]; then
        print_error "sam-parameters.json no encontrado."
        print_info "Copia sam-parameters.example.json a sam-parameters.json y configura los valores."
        print_info "Obtén los valores de Terraform con: terraform output"
        exit 1
    fi
    
    # Construir el código
    print_info "Construyendo código..."
    npm run build
    
    # Construir con SAM
    print_info "Construyendo con SAM..."
    sam build
    
    # Desplegar
    print_info "Desplegando con SAM..."
    sam deploy --parameter-overrides-file sam-parameters.json
    
    print_info "SAM desplegado exitosamente"
    print_info "Obtén la URL de la API con: aws cloudformation describe-stacks --stack-name $SAM_STACK_NAME --query 'Stacks[0].Outputs'"
}

case "${1:-all}" in
    terraform)
        deploy_terraform
        ;;
    sam)
        deploy_sam
        ;;
    all)
        deploy_terraform
        echo
        print_info "Espera unos minutos para que RDS esté disponible..."
        print_warn "Luego actualiza sam-parameters.json con los valores de Terraform"
        print_info "Para obtener los valores: cd terraform && terraform output"
        echo
        read -p "¿Continuar con el despliegue de SAM? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            deploy_sam
        fi
        ;;
    *)
        echo "Uso: $0 [terraform|sam|all]"
        exit 1
        ;;
esac
