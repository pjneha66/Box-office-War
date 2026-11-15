#!/usr/bin/env python3
"""Patch versionCode/versionName inside a compiled AndroidManifest.xml (AXML).
Correct approach: decode the string pool + walk chunks, patch only the
manifest element's versionCode attribute data and the versionName string.
Usage: patch_axml.py <in.apk> <out.apk> <www_dir> <versionCode> <versionName>
"""
import struct, sys, zipfile, os

def parse_chunks(data):
    """Yield (type, header_size, body_offset, size) for top-level chunks."""
    off = 8  # file header: type(2) headerSize(2) size(4)
    while off < len(data):
        ctype, hsz, size = struct.unpack_from('<HHI', data, off)
        if size == 0:
            break
        yield (ctype, hsz, off, size)
        off += size

def read_string_pool(data, chunk_off):
    """Return (strings, strings_abs_offsets, header_size, chunk_size)."""
    ctype, hsz, size = struct.unpack_from('<HHI', data, chunk_off)
    strcount, stylecount, flags, strstart, stylestart = struct.unpack_from('<IIIII', data, chunk_off + 8)
    utf8 = bool(flags & 0x100)
    offs = struct.unpack_from('<%dI' % strcount, data, chunk_off + 28)
    base = chunk_off + strstart
    strings, absoffs = [], []
    for o in offs:
        p = base + o
        absoffs.append(p)
        if utf8:
            # u16 char len (possibly 2 words), u8/u16 byte len, bytes, NUL
            clen = struct.unpack_from('<H', data, p)[0]
            p2 = p + 2
            if clen & 0x8000:
                clen = ((clen & 0x7FFF) << 16) | struct.unpack_from('<H', data, p2)[0]
                p2 += 2
            blen = data[p2]
            p2 += 1
            if blen & 0x80:
                blen = ((blen & 0x7F) << 8) | data[p2]
                p2 += 1
            strings.append(data[p2:p2 + blen].decode('utf-8'))
        else:
            clen = struct.unpack_from('<H', data, p)[0]
            p2 = p + 2
            if clen & 0x8000:
                clen = ((clen & 0x7FFF) << 16) | struct.unpack_from('<H', data, p2)[0]
                p2 += 2
            strings.append(data[p2:p2 + clen * 2].decode('utf-16-le'))
    return strings, absoffs, hsz, size

def main():
    in_apk, out_apk, www_dir, new_code, new_name = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
    src = zipfile.ZipFile(in_apk, 'r')
    manifest = bytearray(src.read('AndroidManifest.xml'))

    # locate string pool chunk
    sp_off = None
    for ctype, hsz, off, size in parse_chunks(manifest):
        if ctype == 0x0001:
            sp_off = off
            break
    assert sp_off is not None, "no string pool"
    strings, absoffs, sp_hsz, sp_size = read_string_pool(manifest, sp_off)
    name_idx = {s: i for i, s in enumerate(strings)}

    # 1) patch versionName string in place (same char/byte length required)
    vn_idx = None
    for i, s in enumerate(strings):
        if s and s[0].isdigit() and '.' in s and len(s) <= 8 and all(c.isdigit() or c == '.' for c in s):
            vn_idx = i  # last short digit-dot string wins; verify via attribute below
    # find versionName attr raw string properly below; for now remember candidate offsets
    patched_name = False

    # 2) walk XML chunks; find START_TAG 'manifest', patch versionCode data + versionName string index
    resmap_off = sp_off + sp_size
    pos = resmap_off
    str_offsets = {}
    data = bytes(manifest)
    while pos < len(manifest):
        ctype, hsz, size = struct.unpack_from('<HHI', manifest, pos)
        if ctype == 0x0102:  # start element
            # header: type,hsz,size | lineno(4), comment(4) = 16 bytes header
            ns, name, attrstart, attrsize, attrcount = struct.unpack_from('<IIHHH', manifest, pos + 16)
            a = pos + 16 + attrstart
            for ai in range(attrcount):
                base = a + ai * attrsize
                ans, aname, araw = struct.unpack_from('<III', manifest, base)
                vsize, vres, vtype = struct.unpack_from('<HBB', manifest, base + 12)
                vdata = struct.unpack_from('<I', manifest, base + 16)[0]
                an = strings[aname] if aname < len(strings) else '?'
                if an == 'versionCode':
                    struct.pack_into('<I', manifest, base + 16, new_code)
                    print(f"versionCode attr patched → {new_code}")
                elif an == 'versionName':
                    vn_idx = araw if araw != 0xFFFFFFFF else vdata
                    print(f"versionName attr → string idx {vn_idx} (was '{strings[vn_idx] if vn_idx is not None and vn_idx < len(strings) else '?'})")
        pos += size if size else len(manifest)

    # 3) rewrite versionName string bytes in the pool (same-length UTF-8/UTF-16)
    if vn_idx is not None and vn_idx < len(strings):
        old = strings[vn_idx]
        if len(old) == len(new_name) and '.' in old:
            p = absoffs[vn_idx]
            flags = struct.unpack_from('<I', manifest, sp_off + 8 + 8)[0]
            utf8 = bool(flags & 0x100)
            if utf8:
                blen = manifest[p + 2] if not (manifest[p + 2] & 0x80) else 0
                # byte-length byte sits after char length; simpler: scan for the first byte of payload
                # char len (u16) then byte len (u8 or u16)
                clen = struct.unpack_from('<H', manifest, p)[0]
                p2 = p + 2
                if clen & 0x8000: p2 += 2
                if manifest[p2] & 0x80: p2 += 1
                p2 += 1
                nb = new_name.encode('utf-8')
                manifest[p2:p2 + len(nb)] = nb
            else:
                clen = struct.unpack_from('<H', manifest, p)[0]
                p2 = p + 2
                if clen & 0x8000: p2 += 2
                nb = new_name.encode('utf-16-le')
                manifest[p2:p2 + len(nb)] = nb
            print(f"versionName string patched '{old}' → '{new_name}' ({'utf8' if utf8 else 'utf16'})")
            patched_name = True
        else:
            print(f"versionName '{old}' length {len(old)} != '{new_name}' length {len(new_name)} — string left unchanged")

    # 4) write out APK with new manifest + www assets
    with zipfile.ZipFile(out_apk, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in src.infolist():
            n = item.filename
            if n == 'AndroidManifest.xml':
                zout.writestr(item, bytes(manifest))
            elif n.startswith('assets/www/') or n == 'assets/www':
                continue  # replaced below
            else:
                zout.writestr(item, src.read(item))
        www = os.listdir(www_dir)
        for f in sorted(www):
            if f.startswith('._'):
                continue
            zout.writestr('assets/www/' + f, open(os.path.join(www_dir, f), 'rb').read())
        # subdirs if any (none expected)
    src.close()
    print(f"wrote {out_apk} ({os.path.getsize(out_apk)} bytes) — name patched: {patched_name}")

if __name__ == '__main__':
    main()
