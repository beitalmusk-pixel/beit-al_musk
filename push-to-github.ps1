# سكريبت لرفع مشروع بيت المسك إلى GitHub بنقرة واحدة
param(
    [string]$RepoUrl
)

$git = "C:\Users\Compu Europe\AppData\Local\github-copilot-git-2.56.1-ea9031cd612f5083a047e714b55b7ee09ffe7c2cc2e9388a8c68b6169e79b26b\cmd\git.exe"

if (-not (Test-Path $git)) {
    $git = "git"
}

if (-not $RepoUrl) {
    Write-Host "=============================================" -ForegroundColor Gold
    Write-Host "   رفع مشروع بيت المسك إلى مستودع GitHub" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Gold
    $RepoUrl = Read-Host "الصق رابط المستودع من GitHub (مثال: https://github.com/USERNAME/beit-al-musk.git)"
}

if ($RepoUrl) {
    Write-Host "`nجاري ربط المستودع ورفع الملفات..." -ForegroundColor Yellow
    & $git remote remove origin 2>$null
    & $git remote add origin $RepoUrl
    & $git branch -M main
    & $git push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[تم بنجاح!] تم رفع الملفات إلى GitHub. يمكنك الآن الذهاب إلى Vercel والضغط على Deploy." -ForegroundColor Green
    } else {
        Write-Host "`nيرجى التأكد من تسجيل الدخول أو إدخال الـ Personal Access Token عند الطلب." -ForegroundColor Red
    }
}
