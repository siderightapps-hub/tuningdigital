$files = Get-ChildItem -Path "." -Filter "*.html" -Recurse

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $content = $content.Replace("Jan 2025", "Mar 2026")
    $content = $content.Replace("Dec 2024", "Jan 2026")
    $content = $content.Replace("Nov 2024", "Feb 2026")
    $content = $content.Replace("Oct 2024", "Dec 2025")
    $content = $content.Replace("2025 Tuning Digital", "2026 Tuning Digital")
    [System.IO.File]::WriteAllText($file.FullName, $content)
    Write-Host "Updated: $($file.Name)"
}

Write-Host "Done!"
