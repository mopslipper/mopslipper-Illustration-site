# 旧サイト → 新構成へのデータ・アセット移行スクリプト(一回限り)
$ErrorActionPreference = 'Stop'
$old = 'C:\Users\shiki\Documents\github\repository\0-mopslippers-illustration_site'
$new = 'C:\Users\shiki\Documents\github\repository\6-mopslippers-illustration_site'

New-Item -ItemType Directory -Force -Path "$new\data", "$new\site\src\assets\works", "$new\site\public\media\works", "$new\tools" | Out-Null

Copy-Item "$old\data\works.json", "$old\data\config.json", "$old\data\commission.json" "$new\data\" -Force

$imgs = Get-ChildItem "$old\static\img\works" -File
$videoExt = '.mp4', '.mov', '.webm'
$videos = $imgs | Where-Object { $_.Extension.ToLower() -in $videoExt }
$stills = $imgs | Where-Object { $_.Extension.ToLower() -notin $videoExt }
$stills | Copy-Item -Destination "$new\site\src\assets\works\" -Force
$videos | Copy-Item -Destination "$new\site\public\media\works\" -Force
Write-Output "stills: $($stills.Count) / videos: $($videos.Count)"

# ヒーロー画像などworks以外のトップレベル画像
Get-ChildItem "$old\static\img" -File | Copy-Item -Destination "$new\site\src\assets\" -Force
Write-Output ("root images: " + ((Get-ChildItem "$old\static\img" -File).Name -join ', '))
