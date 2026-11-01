# ChartCard

A titled chart surface with a head (title, optional segmented toggle, legend) and a body that fills.

The consumer provides the series and the legend. Lines use `signal-graphic` for the factor under test and `stroke` for the reference; gridlines `grid`. Never colour a series by up or down. A table alternative for the same data sits under the chart. States: default, loading (StateBlock inside the body), empty, error. Long axis labels truncate.
