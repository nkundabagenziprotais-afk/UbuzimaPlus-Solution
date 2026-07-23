<IfModule mod_rewrite.c>
  RewriteEngine On

  # Route Laravel API and Sanctum requests to Laravel front controller shims.
  RewriteRule ^api(/.*)?$ /api/index.php [L,QSA]
  RewriteRule ^sanctum(/.*)?$ /sanctum/index.php [L,QSA]
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "^(index\.html|sw\.js)$">
    Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
    Header set Pragma "no-cache"
    Header set Expires "0"
  </FilesMatch>
</IfModule>
