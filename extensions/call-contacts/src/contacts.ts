import { execFile } from "child_process";
import { promisify } from "util";
import { cleanupStalePhotos, PHOTO_DIR } from "./photos";
import { prettyLabel } from "./utils";

const execFileAsync = promisify(execFile);

/** Kill a hung osascript (e.g. a pending permission prompt) after this long. */
const SCRIPT_TIMEOUT_MS = 20_000;

export type Phone = {
  label: string;
  value: string;
};

export type Contact = {
  id: string;
  name: string;
  org: string;
  phones: Phone[];
};

export type ContactsResult = {
  contacts: Contact[];
  /** Filename-safe contact ids that have a photo in the on-disk cache. */
  photoIds: string[];
};

/**
 * JXA script using the ObjC bridge (no Apple Events — Contacts.app is never
 * launched). One pass over CNContactStore returns every contact that has a
 * phone number AND incrementally dumps photo thumbnails into the cache
 * directory (a thumbnail is rewritten only when its size changed).
 *
 * This is the single data path of the extension: one macOS permission
 * (Contacts), one process spawn, one source of contact ids.
 *
 * Phone labels come back already localized via CNLabeledValue
 * (e.g. "mobile" / "сотовый"); custom labels are returned as-is.
 */
const CONTACTS_JXA = `
ObjC.import("Contacts");
ObjC.import("Foundation");
function run(argv) {
  const photoDir = argv[0];
  const store = $.CNContactStore.alloc.init;
  const fm = $.NSFileManager.defaultManager;
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(photoDir, true, $(), $());

  const keys = $([
    $.CNContactIdentifierKey,
    $.CNContactOrganizationNameKey,
    $.CNContactPhoneNumbersKey,
    $.CNContactThumbnailImageDataKey,
    $.CNContactFormatter.descriptorForRequiredKeysForStyle($.CNContactFormatterStyleFullName),
  ]);

  const containers = store.containersMatchingPredicateError($(), $());
  if (containers.isNil()) return JSON.stringify({ error: "access" });

  const seen = {};
  const contacts = [];
  const photos = [];
  for (let i = 0; i < containers.count; i++) {
    const cid = containers.objectAtIndex(i).identifier;
    const pred = $.CNContact.predicateForContactsInContainerWithIdentifier(cid);
    const batch = store.unifiedContactsMatchingPredicateKeysToFetchError(pred, keys, $());
    if (batch.isNil()) continue;
    for (let j = 0; j < batch.count; j++) {
      const c = batch.objectAtIndex(j);
      const id = c.identifier.js;
      if (seen[id]) continue;
      seen[id] = true;

      const pns = c.phoneNumbers;
      if (pns.count === 0) continue;
      const phones = [];
      for (let k = 0; k < pns.count; k++) {
        const lv = pns.objectAtIndex(k);
        let value = "";
        try { value = lv.value.stringValue.js || ""; } catch (e) {}
        if (!value) continue;
        let label = "";
        const rawLabel = lv.label;
        if (!rawLabel.isNil()) {
          const localized = $.CNLabeledValue.localizedStringForLabel(rawLabel);
          label = localized.isNil() ? rawLabel.js : localized.js;
        }
        phones.push({ label: label, value: value });
      }
      if (phones.length === 0) continue;

      const org = c.organizationName.js || "";
      let name = "";
      const formatted = $.CNContactFormatter.stringFromContactStyle(c, $.CNContactFormatterStyleFullName);
      if (!formatted.isNil()) name = formatted.js;
      if (!name) name = org;
      if (!name) name = phones[0].value;

      contacts.push({ id: id, name: name, org: org, phones: phones });

      const data = c.thumbnailImageData;
      if (!data.isNil()) {
        const safe = id.replace(/[^a-zA-Z0-9-]/g, "_");
        const filePath = photoDir + "/" + safe + ".jpg";
        let needWrite = true;
        if (fm.fileExistsAtPath(filePath)) {
          const attrs = fm.attributesOfItemAtPathError(filePath, $());
          if (!attrs.isNil()) {
            const size = ObjC.unwrap(attrs.objectForKey($.NSFileSize));
            if (size === ObjC.unwrap(data.length)) needWrite = false;
          }
        }
        if (needWrite) data.writeToFileAtomically(filePath, true);
        photos.push(safe);
      }
    }
  }
  return JSON.stringify({ contacts: contacts, photos: photos });
}
`;

/** Thrown when macOS denied Raycast access to Contacts. */
export class ContactsAccessError extends Error {
  constructor() {
    super("Raycast has no access to Contacts");
    this.name = "ContactsAccessError";
  }
}

export async function fetchContacts(): Promise<ContactsResult> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", CONTACTS_JXA, PHOTO_DIR],
      {
        maxBuffer: 1024 * 1024 * 64,
        timeout: SCRIPT_TIMEOUT_MS,
      },
    ));
  } catch (e) {
    if (e instanceof Error && "killed" in e && (e as { killed?: boolean }).killed) {
      throw new Error(
        `Contacts didn't respond within ${SCRIPT_TIMEOUT_MS / 1000}s — answer the permission prompt if there is one, then try again`,
      );
    }
    throw e;
  }

  let parsed: { error?: string; contacts?: Contact[]; photos?: string[] };
  try {
    parsed = JSON.parse(stdout || "{}");
  } catch {
    throw new Error(`Couldn't parse Contacts output: ${stdout.slice(0, 200)}`);
  }
  if (parsed.error === "access") throw new ContactsAccessError();

  const contacts = (parsed.contacts ?? []).map((c) => ({
    ...c,
    phones: c.phones.map((p) => ({ ...p, label: prettyLabel(p.label) })),
  }));
  contacts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const photoIds = parsed.photos ?? [];
  cleanupStalePhotos(new Set(photoIds));

  return { contacts, photoIds };
}
