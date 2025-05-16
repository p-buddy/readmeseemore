# Architecture Thoughts

- anything that crosses a view boundary (e.g. is used in the operation of two or more views, like in both the sidebar and the tabs/dock) should be created and managed by the Grid component