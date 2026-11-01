# ProjectCard

A library card: name and small tag on top, one headline metric line, a sparkline, and a footer with object type and update time.

The consumer provides the name, tag, the single headline metric, sparkline points and the footer facts. This is the card structure adopted from the reference study (structure only). The headline metric is the one focal point of the card in `value-focal` (a signed headline number takes the sign role and a leading + or minus glyph; the headline metric is the card's focal number, so it takes the sign role under option C and the Settings convention, see DESIGN.md); its caption is `label`. A verdict, when shown, is the tag (a pill), never a coloured card. At most one primary button per card, shown in a quiet footer link or on hover, not as a permanent row of chips. States: default, hover (`hover` wash), selected, stale, long name (ellipsis).
