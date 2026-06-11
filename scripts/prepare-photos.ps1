# Resize employee photos to 512px thumbnails and build a slug->name map.
Add-Type -AssemblyName System.Drawing

$src = "G:\2026\DRT\HR\Memory of tree\public\employees\HÌNH ẢNH NHÂN VIÊN 2026"
$dst = "G:\2026\DRT\HR\Memory of tree\public\employees\thumbs"
$mapPath = "G:\2026\DRT\HR\Memory of tree\scripts\photo-map.json"

New-Item -ItemType Directory -Force $dst | Out-Null

function Get-Slug([string]$name) {
    $n = $name.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($c in $n.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($c)
        }
    }
    $s = $sb.ToString()
    $s = $s -creplace 'đ', 'd' -creplace 'Đ', 'D'
    $s = $s.ToLower() -replace '[^a-z0-9]+', '-'
    return $s.Trim('-')
}

$usedSlugs = @{}
$map = @()

Get-ChildItem $src -File | Sort-Object Name | ForEach-Object {
    $base = [IO.Path]::GetFileNameWithoutExtension($_.Name)
    $slug = Get-Slug $base
    if ($usedSlugs.ContainsKey($slug)) {
        $i = 2
        while ($usedSlugs.ContainsKey("$slug-$i")) { $i++ }
        $slug = "$slug-$i"
    }
    $usedSlugs[$slug] = $true

    try {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
    } catch {
        Write-Host "SKIP (cannot open): $($_.Name)"
        return
    }

    # Respect EXIF orientation (phone photos)
    if ($img.PropertyIdList -contains 274) {
        $o = $img.GetPropertyItem(274).Value[0]
        switch ($o) {
            3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
            6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
            8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
        }
    }

    $max = 512.0
    $scale = [Math]::Min(1.0, [Math]::Min($max / $img.Width, $max / $img.Height))
    $w = [Math]::Max(1, [int]($img.Width * $scale))
    $h = [Math]::Max(1, [int]($img.Height * $scale))

    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)   # flatten PNG transparency onto white
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()

    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]85)

    $out = Join-Path $dst ($slug + '.jpg')
    $bmp.Save($out, $enc, $ep)
    $bmp.Dispose()
    $img.Dispose()

    $map += [pscustomobject]@{ slug = $slug; name = $base }
}

# Write map without BOM so node can parse it directly
$json = $map | ConvertTo-Json
[IO.File]::WriteAllText($mapPath, $json, (New-Object Text.UTF8Encoding($false)))
Write-Host "Done: $($map.Count) photos -> $dst"
