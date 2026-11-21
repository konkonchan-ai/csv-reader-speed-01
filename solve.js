// Fast drop-in replacement for csv-reader 1.0.0's readCsv: returns the identical
// {columns, rows, errors} answer for every input {text, header}, in one left-to-right pass.
//
// Where the reference builds each field a character at a time, this reads fields as
// slices of the input: an unquoted field is one slice unless a stray CR splits it, and a
// quoted field whose content holds no CR and no doubled quote is one slice too. Quoted
// fields are located with indexOf (a native scan) instead of a per-character walk.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1; // a U+FEFF at the very start is dropped

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended (0 comma, 1 line break, 2 end of text)
  // and how many characters the last unquoted scan appended to it.
  let fValue = '';
  let fEnded = 2;
  let fAdded = 0;

  // Reads unquoted characters from pos onto `initial`: a CR not followed by LF is dropped
  // (stray_cr). Sets fValue, fEnded, fAdded (the characters this scan appended) and
  // leaves pos past the delimiter that ended the field.
  function scanUnquoted(initial) {
    let parts = null; // field segments, once a stray CR splits the field
    let segStart = pos;
    let added = 0;
    let i = pos;
    for (;;) {
      if (i >= n) {
        fValue =
          parts !== null
            ? initial + parts.join('') + text.slice(segStart, n)
            : initial + text.slice(segStart, n);
        fAdded = added + (n - segStart);
        fEnded = 2;
        pos = n;
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 44) {
        // ','
        fValue =
          parts !== null
            ? initial + parts.join('') + text.slice(segStart, i)
            : initial + text.slice(segStart, i);
        fAdded = added + (i - segStart);
        fEnded = 0;
        pos = i + 1;
        return;
      }
      if (c === 10) {
        // LF
        fValue =
          parts !== null
            ? initial + parts.join('') + text.slice(segStart, i)
            : initial + text.slice(segStart, i);
        fAdded = added + (i - segStart);
        fEnded = 1;
        pos = i + 1;
        line += 1;
        return;
      }
      if (c === 13) {
        // CR
        if (text.charCodeAt(i + 1) === 10) {
          fValue =
            parts !== null
              ? initial + parts.join('') + text.slice(segStart, i)
              : initial + text.slice(segStart, i);
          fAdded = added + (i - segStart);
          fEnded = 1;
          pos = i + 2;
          line += 1;
          return;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, i));
        added += i - segStart;
        i += 1;
        segStart = i;
        continue;
      }
      i += 1;
    }
  }

  // Builds a quoted field's content over [a, b) the slow way: each "" is one quote and
  // each CRLF or lone CR is one LF; counts the lines it spans into `line`.
  function buildQuoted(a, b) {
    const parts = [];
    let seg = a;
    let i = a;
    while (i < b) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        // a doubled quote (the closing scan guarantees quotes here pair up)
        parts.push(text.slice(seg, i), '"');
        i += 2;
        seg = i;
        continue;
      }
      if (c === 13) {
        parts.push(text.slice(seg, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        seg = i;
        continue;
      }
      if (c === 10) line += 1;
      i += 1;
    }
    parts.push(text.slice(seg, b));
    return parts.join('');
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function scanQuoted() {
    const openLine = line;
    const contentStart = pos + 1;
    // Find the closing quote: the next quote that is not doubled.
    let i = contentStart;
    let closePos = -1;
    let doubled = false;
    for (;;) {
      const q = text.indexOf('"', i);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        doubled = true;
        i = q + 2;
        continue;
      }
      closePos = q;
      break;
    }
    if (closePos === -1) {
      // The quote never closes: it is a literal character, and the text after it is
      // read again as unquoted.
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      line = openLine;
      pos = contentStart;
      scanUnquoted('"');
      return;
    }
    const cr = text.indexOf('\r', contentStart);
    if (!doubled && (cr === -1 || cr >= closePos)) {
      fValue = text.slice(contentStart, closePos);
      // Count the LFs it spans.
      let lf = text.indexOf('\n', contentStart);
      while (lf !== -1 && lf < closePos) {
        line += 1;
        lf = text.indexOf('\n', lf + 1);
      }
    } else {
      fValue = buildQuoted(contentStart, closePos);
    }
    pos = closePos + 1;
    if (pos >= n) {
      fEnded = 2;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      fEnded = 0;
      pos += 1;
      return;
    }
    if (c === 10) {
      fEnded = 1;
      pos += 1;
      line += 1;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      fEnded = 1;
      pos += 2;
      line += 1;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break (quote_junk, when anything was appended).
    scanUnquoted(fValue);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) scanQuoted();
      else scanUnquoted('');
      fields.push(fValue);
    } while (fEnded === 0);

    // A line that held only stray CRs is left with no characters: no record (its
    // stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
