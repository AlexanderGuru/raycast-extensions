# Call Contacts Changelog

## [Initial Release] - {PR_MERGE_DATE}

- Search macOS contacts by name, organization, or any part of a phone number
- Call with one keystroke via iPhone (Continuity `tel:` link)
- Secondary actions: FaceTime Audio, FaceTime Video, Send Message, Copy Number/Name
- Dial any typed number that is not in your contacts
- Frequently called contacts are sorted to the top (frecency, with Reset Ranking)
- Contact photos with on-disk caching; initials avatars as fallback
- Fast: one CNContactStore pass, no Contacts.app launch, ~500 contacts in about a second
