/**
 * Fill Latitude and Longitude on the GigBook venue spreadsheet, inside Google Sheets.
 *
 * This is Google Apps Script, not part of the app build — it lives here so it doesn't get
 * lost. Paste it into the spreadsheet itself; nothing installs into the repo.
 *
 * ── How to use ────────────────────────────────────────────────────────────────
 *  1. Open the spreadsheet → Extensions → Apps Script.
 *  2. Delete whatever is in Code.gs, paste this whole file, hit Save.
 *  3. Reload the spreadsheet. A "GigBook" menu appears next to Help.
 *  4. GigBook → Fill in coordinates. Approve the permission prompt the first time —
 *     it's asking to read the sheet and use Google's geocoder.
 *  5. When it finishes: File → Download → Comma-separated values (.csv).
 *
 * ── Why a menu item and not a =GEOCODE() formula ──────────────────────────────
 * A custom function re-runs every time the sheet recalculates, which burns the daily
 * geocoding quota and leaves you with cells that fail on reload. This writes plain
 * numbers once and never touches them again.
 *
 * ── If it stops early ─────────────────────────────────────────────────────────
 * Apps Script caps a single run at a few minutes. Rows that already have a latitude are
 * skipped, so just run it again — it picks up where it stopped.
 *
 * ── Quota ─────────────────────────────────────────────────────────────────────
 * The built-in geocoder has a daily limit (in the low thousands of lookups for a normal
 * account). 222 venues is comfortably inside it, and re-runs only cost what's left to do.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GigBook')
    .addItem('Fill in coordinates', 'fillCoordinates')
    .addItem('Clear coordinates', 'clearCoordinates')
    .addToUi();
}

function fillCoordinates() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return;

  var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var nameCol = header.indexOf('venue');
  var addressCol = header.indexOf('address');
  if (addressCol === -1) {
    SpreadsheetApp.getUi().alert('No "Address" column on this sheet.');
    return;
  }

  // Add the output columns if the sheet doesn't have them yet.
  var latCol = header.indexOf('latitude');
  if (latCol === -1) {
    latCol = header.length;
    sheet.getRange(1, latCol + 1).setValue('Latitude');
    header.push('latitude');
  }
  var lngCol = header.indexOf('longitude');
  if (lngCol === -1) {
    lngCol = header.length;
    sheet.getRange(1, lngCol + 1).setValue('Longitude');
    header.push('longitude');
  }

  // Bias to Australia, or "Wonthaggi" and friends land in the wrong hemisphere.
  var geocoder = Maps.newGeocoder().setRegion('au');
  var filled = 0;
  var missed = [];

  for (var i = 1; i < rows.length; i++) {
    var address = String(rows[i][addressCol] || '').trim();
    var already = rows[i][latCol];
    if (!address || (already !== '' && already !== undefined && already !== null)) continue;

    // Name plus address beats address alone: it matches the business, not just the building.
    var venue = nameCol === -1 ? '' : String(rows[i][nameCol] || '').trim();
    var query = venue ? venue + ', ' + address : address;

    try {
      var result = geocoder.geocode(query);
      if (result.status === 'OK' && result.results.length) {
        var loc = result.results[0].geometry.location;
        sheet.getRange(i + 1, latCol + 1).setValue(loc.lat);
        sheet.getRange(i + 1, lngCol + 1).setValue(loc.lng);
        filled++;
      } else {
        missed.push(venue || address);
      }
    } catch (err) {
      missed.push((venue || address) + ' (' + err.message + ')');
    }

    Utilities.sleep(200);
  }

  var report = 'Filled ' + filled + ' row(s).';
  if (missed.length) {
    report += '\n\n' + missed.length + ' could not be found — fix the address or leave them'
      + ' blank and they simply won\'t appear on the map:\n\n' + missed.slice(0, 20).join('\n');
    if (missed.length > 20) report += '\n… and ' + (missed.length - 20) + ' more.';
  }
  SpreadsheetApp.getUi().alert(report);
}

/** Wipe both columns, for when addresses have been corrected and you want a clean run. */
function clearCoordinates() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear every latitude and longitude?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var sheet = SpreadsheetApp.getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var latCol = header.indexOf('latitude');
  var lngCol = header.indexOf('longitude');

  if (latCol !== -1) sheet.getRange(2, latCol + 1, rows.length - 1, 1).clearContent();
  if (lngCol !== -1) sheet.getRange(2, lngCol + 1, rows.length - 1, 1).clearContent();
}
