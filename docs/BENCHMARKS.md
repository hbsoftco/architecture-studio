# Performance baseline

Measured with headless 155.0.8059.79 on 13th Gen Intel(R) Core(TM) i7-13620H, 31 GiB RAM. Production Vite preview at 127.0.0.1:4173. Fixture: `samples/starter-project.zip` (one document each for Mermaid, BPMN, DMN, and C4). Single run; times include browser UI and lazy module loading, and are not statistical benchmarks.

| Measurement | Result |
| --- | ---: |
| Release directory size | 6.97 MiB |
| Initial app ready | 146 ms |
| Sample project ZIP import | 98 ms |
| Mermaid first render | 416 ms |
| BPMN first render | 97 ms |
| DMN first render | 189 ms |
| C4 graph first render | 81 ms |
| Browser JS heap after editors | 20.1 MiB |

Large-diagram rendering and memory release after editor close remain unmeasured.
