# Build merged word list for kivozo Word Explorer.
# Sources:
#   1. dwyl/english-words words_alpha.txt  -> ./candidate.txt   (~370k classic words+inflections)
#   2. hermitdave/FrequencyWords en_50k     -> ./freq50k.txt     (modern OpenSubtitles vocab)
#   3. first20hours/google-10000-english    -> ./modern.txt      (top modern web words)
#   4. hand-curated supplement (below)      (recent web/tech terms missing from all three)
#
# Output: words.new.txt  (lowercase a-z, sorted, one per line)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$set = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($line in [System.IO.File]::ReadAllLines("$PSScriptRoot\candidate.txt")) {
  $w = $line.Trim().ToLower()
  if ($w -match '^[a-z]+$') { [void]$set.Add($w) }
}
Write-Host "after dwyl:       $($set.Count)"

foreach ($line in [System.IO.File]::ReadAllLines("$PSScriptRoot\freq50k.txt")) {
  $w = ($line -split '\s+')[0].Trim().ToLower()
  if ($w -match '^[a-z]+$' -and ($w.Length -ge 2 -or $w -in 'a','i')) { [void]$set.Add($w) }
}
Write-Host "after OpenSubs:   $($set.Count)"

foreach ($line in [System.IO.File]::ReadAllLines("$PSScriptRoot\modern.txt")) {
  $w = $line.Trim().ToLower()
  if ($w -match '^[a-z]+$') { [void]$set.Add($w) }
}
Write-Host "after google-10k: $($set.Count)"

$supplement = @(
  'crowdfunding','crowdfunded','crowdfunder','crowdfunders',
  'retweet','retweets','retweeted','retweeting',
  'memes','memed','meming','memeable',
  'blockchain','blockchains',
  'nft','nfts',
  'crypto','cryptos','cryptocurrency','cryptocurrencies',
  'startups',
  'firmware','middleware','shareware','adware','ransomware',
  'doxxing','doxxed','dox','doxx',
  'metaverse','metaverses',
  'deepfake','deepfakes',
  'chatbot','chatbots',
  'unfollow','unfollows','unfollowed','unfollowing',
  'unfriend','unfriends','unfriended','unfriending',
  'rebrand','rebrands','rebranded','rebranding',
  'screenshot','screenshots','screenshotted','screenshotting',
  'screencast','screencasts',
  'subreddit','subreddits',
  'subtweet','subtweets',
  'upvote','upvotes','upvoted','upvoting',
  'downvote','downvotes','downvoted','downvoting',
  'paywall','paywalls','paywalled',
  'clickbait','clickbaity',
  'doomscroll','doomscrolling','doomscrolled',
  'humblebrag','humblebrags',
  'photobomb','photobombs','photobombed','photobombing',
  'sexting','sexted',
  'permalink','permalinks',
  'permadeath',
  'ragequit','ragequits','ragequitting',
  'hashtags','emojis','selfies',
  'vlogs','vlogger','vloggers','vlogging','vlogged',
  'glamping','glamper','glampers',
  'staycation','staycations',
  'mansplain','mansplains','mansplained','mansplaining',
  'cringey','cringy','cringier','cringiest',
  'adulting','adulted',
  'bingeable','bingeworthy',
  'esports','egirl','eboy',
  'youtuber','youtubers',
  'tiktok','tiktoks',
  'instagrams','instagrammable','instagrammer','instagrammers',
  'whatsapp','discord','reddit','spotify','wikipedia',
  'kivozo'
)
foreach ($w in $supplement) {
  if ($w -match '^[a-z]+$') { [void]$set.Add($w) }
}
Write-Host "after supplement: $($set.Count)"

$sorted = $set | Sort-Object
[System.IO.File]::WriteAllLines("$PSScriptRoot\words.new.txt", $sorted, (New-Object System.Text.UTF8Encoding($false)))

$count = (Get-Content "$PSScriptRoot\words.new.txt" | Measure-Object -Line).Lines
$bytes = (Get-Item "$PSScriptRoot\words.new.txt").Length
Write-Host "wrote: $count lines, $bytes bytes -> words.new.txt"
