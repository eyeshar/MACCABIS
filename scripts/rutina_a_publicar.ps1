<#
  rutina_a_publicar.ps1 — rutina A automática (D66): procesa la jornada y la publica sola si todo cuadra.

  La lanza el Programador de tareas de Windows (lunes y jueves a las 13:00, con la sesión de Iván iniciada),
  después de que la tarea programada de Claude «Maccabis · actas del lunes» (8:34) baje las actas a Descargas.
  Las hojas de estadística las baja Iván desde la app Afición FBM. Script determinista, sin agentes:

    1. main al día: para si no está en main, si hay cambios locales sin commitear o commits sin subir; git pull.
    2. npm run jornada -- --no-interactivo: ante cualquier duda para (código distinto de 0); sin ficheros nuevos,
       sale sin hacer nada.
    3. test:regresion, test:liga, test:privacidad y check:copias.
    4. Commit de data/ y plataforma/src/data/ («datos(2026-27): jornada N (automático)») y push.
    5. En plataforma/: npm run db:liga, npm run db:asistencia y verificar_produccion (tras esperar al despliegue).

  Si algo falla antes del push no se publica nada: deja el repositorio como estaba (git reset al commit de partida)
  y borra las copias que hizo en fuentes_fbm/, para que la siguiente ejecución las vuelva a ver como nuevas.
  Cada ejecución añade una línea a privado/registro_rutina_a.log (fuera de git) y termina con un aviso de Windows.

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rutina_a_publicar.ps1         (de verdad)
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rutina_a_publicar.ps1 -Dry    (en seco: no escribe,
        no hace pull ni commit; la rama y los cambios locales solo se avisan)
#>
param([switch]$Dry)

# Continue: en PowerShell 5.1, con Stop, cualquier aviso de git por stderr (2>$null) se convierte en excepción.
# Los fallos se miran por el código de salida de cada comando (Parar).
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

$Temporada = '2026-27'
$Repo = Split-Path -Parent $PSScriptRoot
$Plataforma = Join-Path $Repo 'plataforma'
$Log = Join-Path $Repo 'privado\registro_rutina_a.log'
$Resumen = Join-Path $env:TEMP "rutina_a_resumen_$PID.json"
$EsperaDespliegue = 240          # segundos que se deja a Vercel desplegar el push antes de verificar producción

$script:inicio = $null           # commit de partida (para dejarlo todo como estaba si falla)
$script:copiados = @()           # copias nuevas en fuentes_fbm/ de esta ejecución
$script:publicado = $false
$script:ultimo = @()             # salida del último comando (va al registro si para)

function Linea([string]$Texto) { Write-Host $Texto }

function Parar([string]$Motivo) { throw "PARADA:$Motivo" }

<# Ejecuta un comando con cmd /c (en PowerShell 5.1, el 2>&1 de un ejecutable convierte stderr en errores). #>
function Ejecutar([string]$Que, [string]$Dir, [string]$Comando) {
  Linea "== $Que"
  Push-Location $Dir
  try { $lineas = @(& cmd.exe /d /c "$Comando 2>&1") } finally { Pop-Location }
  $codigo = $LASTEXITCODE
  $lineas | ForEach-Object { Linea "   $_" }
  $script:ultimo = $lineas
  return $codigo
}

function GitOk([string[]]$Argumentos) {
  $r = @(& git -C $Repo @Argumentos 2>$null)
  if ($LASTEXITCODE -ne 0) { Parar "falla git $($Argumentos -join ' ')." }
  return $r
}

function Registrar([string]$Resultado, [string]$Texto, [switch]$ConDetalle) {
  $lineas = @('{0}  {1}{2}  {3}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Resultado, $(if ($Dry) { ' (en seco)' } else { '' }), $Texto)
  if ($ConDetalle -and $script:ultimo.Count) { $lineas += @($script:ultimo | Select-Object -Last 40 | ForEach-Object { "      $_" }) }
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path $Log) | Out-Null
    Add-Content -LiteralPath $Log -Value $lineas -Encoding UTF8
  } catch { Linea "(no se ha podido escribir en $Log`: $($_.Exception.Message))" }
}

<# Notificación de Windows (toast) a nombre de Windows PowerShell. #>
function Avisar([string]$Texto) {
  try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $esc = { param($s) [Security.SecurityElement]::Escape($s) }
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>Maccabis · rutina A</text><text>$(& $esc $Texto)</text></binding></visual></toast>")
    $app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch { Linea "(no se ha podido mostrar el aviso: $($_.Exception.Message))" }
}

<# Deja el repositorio como al empezar y borra las copias de esta ejecución en fuentes_fbm/. #>
function Limpiar {
  if ($script:inicio) {
    & git -C $Repo reset -q --hard $script:inicio 2>$null
    & git -C $Repo clean -q -fd -- data plataforma/src/data 2>$null
  }
  foreach ($f in $script:copiados) { if ($f -and (Test-Path -LiteralPath $f)) { Remove-Item -LiteralPath $f -Force } }
}

try {
  Linea "Rutina A $Temporada$(if ($Dry) { ' (en seco)' }) en $Repo"

  # 1. main al día y limpio (en seco solo se avisa)
  $rama = @(GitOk @('rev-parse', '--abbrev-ref', 'HEAD'))[0]
  if ($rama -ne 'main') {
    if ($Dry) { Linea "!  el repositorio está en la rama $rama, no en main (en seco se sigue)." }
    else { Parar "el repositorio está en la rama $rama, no en main." }
  }
  $sucio = GitOk @('status', '--porcelain')
  if ($sucio.Count) {
    $lista = ($sucio | Select-Object -First 3 | ForEach-Object { $_.Substring(3) }) -join ', '
    if ($Dry) { Linea "!  hay $($sucio.Count) cambio(s) local(es) sin commitear ($lista; en seco se sigue)." }
    else { Parar "hay $($sucio.Count) cambio(s) local(es) sin commitear ($lista)." }
  }
  if (-not $Dry) {
    if ((Ejecutar 'git pull' $Repo 'git pull --ff-only --quiet') -ne 0) { Parar 'git pull ha fallado.' }
    $sinSubir = @(GitOk @('rev-list', '--count', 'origin/main..HEAD'))[0]
    if ($sinSubir -ne '0') { Parar "main tiene $sinSubir commit(s) sin subir." }
  }
  $script:inicio = @(GitOk @('rev-parse', 'HEAD'))[0]

  # 2. Procesar la jornada sin preguntas
  $extra = if ($Dry) { ' --dry' } else { '' }
  $codigo = Ejecutar 'npm run jornada (no interactivo)' $Repo "npm run jornada -- --no-interactivo --resumen `"$Resumen`"$extra"
  $res = if (Test-Path -LiteralPath $Resumen) { Get-Content -LiteralPath $Resumen -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
  if ($res) { $script:copiados = @($res.copiados) }
  if ($codigo -ne 0) { Parar $(if ($res -and $res.motivo) { $res.motivo } else { "npm run jornada ha fallado (código $codigo)." }) }
  if (-not $res) { Parar 'npm run jornada no ha dejado su resumen.' }
  if ($res.estado -eq 'nada') {
    Linea 'Nada nuevo: no hay ficheros nuevos de la temporada.'
    Registrar 'NADA NUEVO' 'no hay ficheros nuevos.'
    exit 0
  }
  if ($Dry) {
    Linea "En seco: habría publicado «$($res.texto)»."
    Registrar 'EN SECO' "habría publicado: $($res.texto)"
    exit 0
  }

  # 3. Pruebas
  foreach ($t in 'test:regresion', 'test:liga', 'test:privacidad', 'check:copias') {
    if ((Ejecutar "npm run $t" $Repo "npm run $t") -ne 0) { Parar "falla npm run $t." }
  }

  # 4. Commit y push de data/ y plataforma/src/data/
  GitOk @('add', '--', 'data', 'plataforma/src/data') | Out-Null
  $cambios = GitOk @('diff', '--cached', '--name-only')
  if (-not $cambios.Count) {
    Linea 'Ficheros nuevos, pero data/ y plataforma/src/data/ no cambian: no hay nada que publicar.'
    Registrar 'SIN CAMBIOS' "$($res.nuevos) fichero(s) nuevo(s) copiados a fuentes_fbm/, sin cambios en data/."
    exit 0
  }
  $que = if ($res.jornada) { "jornada $($res.jornada)" } else { 'liga' }
  $mensaje = Join-Path $env:TEMP "rutina_a_commit_$PID.txt"
  [IO.File]::WriteAllText($mensaje, "datos(${Temporada}): $que (automático)`n`n$($res.texto)`n", (New-Object Text.UTF8Encoding $false))
  try { $codigo = Ejecutar 'git commit' $Repo "git commit -q -F `"$mensaje`"" } finally { [IO.File]::Delete($mensaje) }
  if ($codigo -ne 0) { Parar 'git commit ha fallado.' }
  if ((Ejecutar 'git push' $Repo 'git push --quiet origin main') -ne 0) { Parar 'git push ha fallado.' }
  $script:publicado = $true

  # 5. Supabase y verificación de producción (lo publicado ya no se deshace: los fallos se avisan)
  $fallos = @()
  foreach ($t in 'db:liga', 'db:asistencia') {
    if ((Ejecutar "npm run $t (plataforma)" $Plataforma "npm run $t") -ne 0) { $fallos += $t }
  }
  Linea "== esperando $EsperaDespliegue s al despliegue de Vercel"
  Start-Sleep -Seconds $EsperaDespliegue
  if ((Ejecutar 'verificar_produccion' $Plataforma 'node pruebas/verificar_produccion.mjs') -ne 0) {
    Linea "== segundo intento de verificar_produccion dentro de $EsperaDespliegue s"
    Start-Sleep -Seconds $EsperaDespliegue
    if ((Ejecutar 'verificar_produccion (2º intento)' $Plataforma 'node pruebas/verificar_produccion.mjs') -ne 0) { $fallos += 'verificar_produccion' }
  }
  if ($fallos.Count) {
    $texto = "$($res.texto) — pero falla: $($fallos -join ', ')"
    Registrar 'PUBLICADA CON FALLOS' $texto -ConDetalle
  } else {
    $texto = $res.texto
    Registrar 'PUBLICADA' "$texto (commit $(@(GitOk @('rev-parse', '--short', 'HEAD'))[0]))"
  }
  Avisar $texto
  exit 0
}
catch {
  $motivo = $_.Exception.Message -replace '^PARADA:', ''
  if ($script:publicado) {
    Registrar 'PUBLICADA, PARADA DESPUÉS' $motivo -ConDetalle
    Avisar "Jornada publicada, pero la rutina A se paró después: $motivo"
  } else {
    if (-not $Dry) { Limpiar }
    Registrar 'PARADA' $motivo -ConDetalle
    Avisar "Rutina A parada: $motivo"
  }
  Linea "PARADA: $motivo"
  exit 1
}
finally {
  [IO.File]::Delete($Resumen)   # (Remove-Item no acepta la ruta corta de TEMP, IVN~1)
}
