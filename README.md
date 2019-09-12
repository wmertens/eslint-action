# ESLint Action

This is a GitHub Action that runs ESLint for `.js`, `.jsx`, and `.tsx` files using your `.eslintrc` rules. It's free to run and it'll annotate the diffs of your pull requests with lint errors and warnings.

![](screenshots/annotation.png)

Neat! Bet your CI doesn't do that.

You can pass files and extensions with the `with` property on the job. They will be split on commas.

## Usage

`.github/workflows/nodejs.yml`:

```yaml
# ...
  steps:
    # ...
    - name: eslint
      if: always()
      uses: wmertens/eslint-action@master
      with:
        files: "src,lib,plugins"
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
