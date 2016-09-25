

```
 <Location /primus>
    RewriteEngine on
    RewriteCond %{QUERY_STRING} transport=polling
    RewriteRule .* http://url%{REQUEST_URI} [P]

    ProxyPass  ws://url/primus
    ProxyPassReverse ws://url/primus
    AuthType Shibboleth
    ShibRequireSession On
    ShibExportAssertion On
    ShibUseHeaders On
    Require valid-user
</Location>
```