# fumen-for-mobile

## Third-Party Source Availability

For Cold Clear wasm artifacts included in `src/lib/cold_clear_wasm/`, corresponding
MPL-2.0 source information is provided in:

- `THIRD_PARTY_LICENSES.md`
- `third_party/cold-clear/README.md`

### Memo

#### Bookmarklet Code: Load fumen from official page

```
var value = window.location.href;
if (
    value.match(/fumen.zui.jp\/\?v115@/) ||
    value.match(/fumen.zui.jp\/old\/110/) ||
    value.match(/harddrop.com\/fumen[tool]*/)
) {
    encode(1);
    value = document.getElementById('tx').value;
}

// window.location.href='https://knewjade.github.io/fumen-for-mobile/#?d='+value;
window.open('https://knewjade.github.io/fumen-for-mobile/#?d='+value, '_blank');
```

```
javascript:(function(){###CODE###})()
```
