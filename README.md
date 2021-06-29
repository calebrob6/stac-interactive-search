# Interactive STAC search

An interactive way to query STAC APIs.


## Todos
- [ ] Refactor the way that URLs work when the Planetary Computer endpoint is used. Currently, we try to anonymously sign every link up front which quickly runs into rate limiting issues. Alternatively, we should generate preview images with a single key, and sign all download links onclick.