param([Parameter(Mandatory=$true)][string]$SourcePath, [Parameter(Mandatory=$true)][string]$ArchivePath, [switch]$Extract)
$ErrorActionPreference = 'Stop'
if ($Extract) {
    Expand-Archive -LiteralPath $SourcePath -DestinationPath $ArchivePath -Force
} else {
    Compress-Archive -LiteralPath $SourcePath -DestinationPath $ArchivePath -Force
}
