import {
  Action,
  ActionPanel,
  closeMainWindow,
  Icon,
  Image,
  List,
  open,
  showHUD,
} from "@raycast/api";
import { getAvatarIcon, useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Contact, ContactsAccessError, fetchContacts, Phone } from "./contacts";
import { cachedPhotoPath } from "./photos";
import { matchesQuery, normalizeNumber, parseDialableNumber } from "./utils";

type PhoneItem = {
  /** Stable id (contact id + normalized number) — also the frecency key. */
  id: string;
  contact: Contact;
  phone: Phone;
  number: string;
};

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(fetchContacts, [], {
    keepPreviousData: true,
  });
  const [searchText, setSearchText] = useState("");

  // Photos arrive with the same fetch (one CNContactStore pass): cached
  // results render instantly, the background revalidation refreshes both
  // the contacts and the thumbnail cache.
  const photoIds = useMemo(() => new Set(data?.photoIds ?? []), [data]);

  // One row per phone number; duplicates of the same number within a
  // contact (e.g. listed under two labels) collapse into one row.
  const items = useMemo(() => {
    const result: PhoneItem[] = [];
    for (const contact of data?.contacts ?? []) {
      const seen = new Set<string>();
      contact.phones.forEach((phone, index) => {
        const number = normalizeNumber(phone.value);
        const key = number || `raw-${index}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push({ id: `${contact.id}:${key}`, contact, phone, number });
      });
    }
    return result;
  }, [data]);

  // Frequently called contacts bubble up to the top.
  const { data: sortedItems, visitItem, resetRanking } = useFrecencySorting(items);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return sortedItems;
    const queryDigits = query.replace(/[^0-9]/g, "");
    return sortedItems.filter((item) =>
      matchesQuery(
        {
          name: item.contact.name,
          org: item.contact.org,
          label: item.phone.label,
          number: item.number,
        },
        query,
        queryDigits,
      ),
    );
  }, [sortedItems, searchText]);

  // Offer to dial the typed number, unless it is already in the results.
  const dialNumber = useMemo(() => {
    const number = parseDialableNumber(searchText);
    if (!number) return null;
    return filteredItems.some((item) => item.number === number) ? null : number;
  }, [searchText, filteredItems]);

  if (error) {
    const isAccess = error instanceof ContactsAccessError;
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title={isAccess ? "No Access to Contacts" : "Couldn't Read Contacts"}
          description={
            isAccess
              ? "Allow Raycast to access Contacts in System Settings → Privacy & Security → Contacts, then try again."
              : `${error.message} — try again, or check Contacts access in System Settings.`
          }
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={revalidate} />
              <Action
                title="Open Contacts Settings"
                icon={Icon.Gear}
                onAction={() =>
                  open("x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts")
                }
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search by name or number…"
      filtering={false}
      onSearchTextChange={setSearchText}
    >
      {items.length === 0 && !isLoading && !dialNumber ? (
        <List.EmptyView
          icon={Icon.PersonCircle}
          title="No Contacts with Phone Numbers"
          description="Add a number in the Contacts app, then refresh."
        />
      ) : (
        <>
          {filteredItems.map((item) => (
            <ContactItem
              key={item.id}
              item={item}
              photo={cachedPhotoPath(item.contact.id, photoIds)}
              onRefresh={revalidate}
              onVisit={() => visitItem(item)}
              onResetRanking={() => resetRanking(item)}
            />
          ))}
          {dialNumber && <DialItem number={dialNumber} />}
        </>
      )}
    </List>
  );
}

/** The call / FaceTime / SMS section shared by contact rows and the dial row. */
function CallActions({
  number,
  displayName,
  onVisit,
}: {
  number: string;
  displayName: string;
  onVisit?: () => Promise<void>;
}) {
  async function act(url: string, hudMessage?: string) {
    try {
      await onVisit?.();
      await closeMainWindow();
      await open(url);
      if (hudMessage) await showHUD(hudMessage);
    } catch {
      // The main window is already closed — the HUD is the only way to
      // tell the user something went wrong.
      await showHUD(`Couldn't open ${url.split(":")[0]} link`);
    }
  }

  return (
    <ActionPanel.Section>
      <Action
        // eslint-disable-next-line @raycast/prefer-title-case -- "iPhone" is correct
        title="Call via iPhone"
        icon={Icon.Phone}
        onAction={() => act(`tel:${number}`, `Calling ${displayName}…`)}
      />
      <Action
        // eslint-disable-next-line @raycast/prefer-title-case -- "FaceTime" is correct
        title="FaceTime Audio"
        icon={Icon.Microphone}
        onAction={() => act(`facetime-audio:${number}`)}
      />
      <Action
        // eslint-disable-next-line @raycast/prefer-title-case -- "FaceTime" is correct
        title="FaceTime Video"
        icon={Icon.Video}
        onAction={() => act(`facetime:${number}`)}
      />
      <Action title="Send Message" icon={Icon.Message} onAction={() => act(`sms:${number}`)} />
    </ActionPanel.Section>
  );
}

function ContactItem({
  item,
  photo,
  onRefresh,
  onVisit,
  onResetRanking,
}: {
  item: PhoneItem;
  photo?: string;
  onRefresh: () => void;
  onVisit: () => Promise<void>;
  onResetRanking: () => Promise<void>;
}) {
  const { contact, phone, number } = item;

  return (
    <List.Item
      icon={photo ? { source: photo, mask: Image.Mask.Circle } : getAvatarIcon(contact.name)}
      title={contact.name}
      subtitle={phone.label || undefined}
      accessories={[{ text: phone.value }]}
      actions={
        <ActionPanel>
          <CallActions number={number} displayName={contact.name} onVisit={onVisit} />
          <ActionPanel.Section>
            <Action
              title="Open in Contacts"
              icon={Icon.Person}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
              onAction={() => open(`addressbook://${contact.id}`)}
            />
            <Action.CopyToClipboard
              title="Copy Number"
              content={phone.value}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
              onCopy={onVisit}
            />
            <Action.CopyToClipboard
              title="Copy Name"
              content={contact.name}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              onCopy={onVisit}
            />
            <Action
              title="Refresh Contacts"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRefresh}
            />
            <Action
              title="Reset Ranking"
              icon={Icon.ArrowCounterClockwise}
              onAction={onResetRanking}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

/** A row for dialing the typed number when it isn't in the contacts. */
function DialItem({ number }: { number: string }) {
  return (
    <List.Item
      icon={Icon.Phone}
      title={`Call ${number}`}
      subtitle="Dial typed number"
      actions={
        <ActionPanel>
          <CallActions number={number} displayName={number} />
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Number"
              content={number}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
