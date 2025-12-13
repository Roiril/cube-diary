# Supabase設定ガイド

ゲストログイン機能とプライバシー保護のためのSupabase設定手順です。

## 1. 匿名認証の有効化

Supabaseダッシュボードで匿名認証を有効にする必要があります。

### 手順：
1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. 左メニューから「Authentication」→「Providers」を選択
4. 「Anonymous」プロバイダーを探す
5. 「Enable Anonymous Sign-ins」を有効にする

## 2. ゲスト用サンプルエントリーの作成

ゲストユーザーが閲覧できるサンプルエントリーを作成します。

### 手順：

#### 方法1: Supabaseダッシュボードから直接作成

1. Supabaseダッシュボードで「Table Editor」を開く
2. `entries`テーブルを選択
3. 「Insert row」をクリック
4. 以下の値を設定：
   - `id`: UUID（自動生成または手動で生成）
   - `user_id`: `00000000-0000-0000-0000-000000000000`（固定値）
   - `content`: サンプルメッセージ（例：「これはサンプル日記です」）
   - `image_urls`: JSON配列形式で画像URLを設定（例：`["https://example.com/image1.jpg", "https://example.com/image2.jpg"]`）
   - `created_at`: 現在の日時

#### 方法2: SQL Editorから作成

```sql
-- ゲスト用サンプルエントリーを挿入
INSERT INTO entries (id, user_id, content, image_urls, created_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'これはサンプル日記です。ゲストモードで閲覧できます。',
  '["https://example.com/sample1.jpg", "https://example.com/sample2.jpg"]'::jsonb,
  NOW()
);

-- 複数のサンプルエントリーを作成する場合
INSERT INTO entries (id, user_id, content, image_urls, created_at)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'サンプル1', '["url1"]'::jsonb, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'サンプル2', '["url2"]'::jsonb, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'サンプル3', '["url3"]'::jsonb, NOW());
```

## 3. Row Level Security (RLS) ポリシーの設定

プライバシー保護のため、RLSポリシーを設定して、ユーザーが自分のエントリーのみアクセスできるようにします。

### 手順：

1. Supabaseダッシュボードで「Table Editor」を開く
2. `entries`テーブルを選択
3. 「Policies」タブを開く
4. 以下のポリシーを作成：

#### ポリシー1: ユーザーは自分のエントリーを読み取れる

```sql
CREATE POLICY "Users can read their own entries"
ON entries
FOR SELECT
USING (auth.uid() = user_id);
```

#### ポリシー2: ゲスト用サンプルエントリーは誰でも読み取れる

```sql
CREATE POLICY "Anyone can read guest sample entries"
ON entries
FOR SELECT
USING (user_id = '00000000-0000-0000-0000-000000000000');
```

#### ポリシー3: ユーザーは自分のエントリーを挿入できる

```sql
CREATE POLICY "Users can insert their own entries"
ON entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

#### ポリシー4: ユーザーは自分のエントリーを更新できる

```sql
CREATE POLICY "Users can update their own entries"
ON entries
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### ポリシー5: ユーザーは自分のエントリーを削除できる

```sql
CREATE POLICY "Users can delete their own entries"
ON entries
FOR DELETE
USING (auth.uid() = user_id);
```

### 注意事項：

- RLSが有効になっていることを確認してください（`entries`テーブルの「Settings」で確認）
- 匿名ユーザー（ゲスト）もサンプルエントリーを読み取れるように、ポリシー2は重要です
- ゲストユーザーは`auth.uid()`がnullになる可能性があるため、ポリシー2で明示的に許可する必要があります

## 4. ストレージバケットの設定（画像アップロード用）

画像をアップロードする場合、ストレージバケットの設定も必要です。

### 手順：

1. Supabaseダッシュボードで「Storage」を開く
2. `cube-images`バケットが存在することを確認（存在しない場合は作成）
3. バケットの「Policies」で以下のポリシーを設定：

#### ポリシー1: 認証済みユーザーはアップロードできる

```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cube-images' AND
  auth.role() = 'authenticated'
);
```

#### ポリシー2: 認証済みユーザーは自分のファイルを更新できる

```sql
CREATE POLICY "Authenticated users can update their files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'cube-images' AND
  auth.role() = 'authenticated'
);
```

#### ポリシー3: 誰でも公開ファイルを読み取れる

```sql
CREATE POLICY "Anyone can read public files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cube-images');
```

## 5. 確認事項

設定が正しく動作しているか確認：

- [ ] 匿名認証が有効になっている
- [ ] ゲスト用サンプルエントリーが作成されている（`user_id = '00000000-0000-0000-0000-000000000000'`）
- [ ] RLSポリシーが正しく設定されている
- [ ] 通常ユーザーは自分のエントリーのみ見える
- [ ] ゲストユーザーはサンプルエントリーのみ見える
- [ ] ストレージバケットのポリシーが設定されている（画像アップロードを使用する場合）

## トラブルシューティング

### ゲストユーザーがエントリーを表示できない

- RLSポリシー2（ゲスト用サンプルエントリーの読み取り）が正しく設定されているか確認
- サンプルエントリーの`user_id`が`00000000-0000-0000-0000-000000000000`になっているか確認

### 通常ユーザーが他のユーザーのエントリーを見てしまう

- RLSポリシー1が正しく設定されているか確認
- RLSが有効になっているか確認

### 画像が表示されない

- ストレージバケットのポリシー3（公開読み取り）が設定されているか確認
- 画像URLが正しいか確認

