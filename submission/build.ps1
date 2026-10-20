param([string]$TectonicPath = 'tectonic')

$ErrorActionPreference = 'Stop'
$compiler = (Get-Command $TectonicPath -ErrorAction Stop).Source
$output = Join-Path (Split-Path $PSScriptRoot -Parent) 'output/pdf'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$documents = @(
    @{ Folder = 'technical'; Name = 'BizWizard-Technical-Documentation.pdf' },
    @{ Folder = 'security'; Name = 'BizWizard-Security-Self-Assessment.pdf' },
    @{ Folder = 'evidence'; Name = 'BizWizard-Execution-Evidence-Guide.pdf' }
)
foreach ($document in $documents) {
    $build = Join-Path $PSScriptRoot ('.build/' + $document.Folder)
    New-Item -ItemType Directory -Path $build -Force | Out-Null
    Push-Location (Join-Path $PSScriptRoot $document.Folder)
    try {
        & $compiler --keep-logs --outdir $build main.tex
        if ($LASTEXITCODE -ne 0) { throw "LaTeX compilation failed: $($document.Folder)" }
        Copy-Item -LiteralPath (Join-Path $build 'main.pdf') -Destination (Join-Path $output $document.Name)
        Write-Output "Built $($document.Name)"
    } finally {
        Pop-Location
    }
}
