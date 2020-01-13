# 1.3.1

## Bug Fixes

- Remove verbose logging
- Immediately start getting metrics using new incrementalBuffer pipe - thanks @alexcastillo
- Bug where clicking a toggel button in view could flash check/or-unchecked quickly before showing the correct value again.

## Known Issues

- Intermittent issue where device can fail to restart connection after a disconnection. [#33](https://github.com/neurosity/notion-js/issues/33)

# 1.3.0

## Enhancements

- Move view files to a new location 
- Restart session button added
- Toggle for dim screen and do not disturb added to view

## Known Issues

- Intermittent issue where device can fail to restart connection after a disconnection. [#33](https://github.com/neurosity/notion-js/issues/33)

## Roadmap

- Improve layout with a 2.0.0 release

# 1.2.1

## Fixes

- Fix time stamps to be local time and not in 24 hour time

# 1.2.0

## Enhancements

- Add toggle for dim screen - closes #7
- Add toggle for do not disturb activiation
- Move VueJS webview to another file, `webview.ts`
- Historical plotting from session data - closes #6

## Fixes

- Remove unused notion.focus() metric

# 1.1.2

- Fix CSS for button - closes #5

# 1.1.1

- Add v1.1.0 info to changelog
- Remove bootstrap tags from webview

# 1.1.0

- Remove Notion Logout from status bar into webview

# 1.0.3

- Add changelog content
- Add descriptions to attributes required by this application
- Fix readme

# 1.0.2

- Add marketplace logo

# 1.0.1

- Add authentication instructions to read me

# 1.0.0

- Initial Launch
