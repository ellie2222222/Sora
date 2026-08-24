import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';
import { Archive, Pencil, Trash2 } from 'lucide-react-native';
import type { CategoryResponse } from '@finance/contracts';

import { Button, Card, ErrorState, Input, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useDeleteCategoryPermanently,
  useUpdateCategory,
} from '../hooks/useCategories.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

/** INCOME and EXPENSE are managed as two lists — a category is one or the other, never both. */
export function CategoryListScreen({ route }: AppStackScreenProps<'CategoryList'>) {
  const theme = useTheme();
  const { activeWallet, permissions } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  const [creating, setCreating] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<CategoryResponse | null>(null);

  const expense = useCategories({ walletId: walletId ?? '', type: 'EXPENSE', status: 'ACTIVE' });
  const income = useCategories({ walletId: walletId ?? '', type: 'INCOME', status: 'ACTIVE' });

  if (walletId === undefined) return null;
  if (expense.isLoading || income.isLoading) return <SkeletonList rows={6} rowHeight={44} />;
  if (expense.isError) return <ErrorState error={expense.error} onRetry={() => void expense.refetch()} />;

  const sections = [
    { title: 'Expense categories', data: expense.data ?? [] },
    { title: 'Income categories', data: income.data ?? [] },
  ];

  return (
    <>
      <FlatList
        testID="category-list"
        data={sections}
        keyExtractor={(section) => section.title}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        ListHeaderComponent={
          permissions.canWrite ? (
            <Button label="New category" size="sm" onPress={() => setCreating(true)} style={{ marginBottom: theme.spacing.sm }} />
          ) : null
        }
        renderItem={({ item: section }) => (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.xs }}>
              {section.title}
            </Text>
            {section.data.length === 0 ? (
              <Text tone="faint">None yet.</Text>
            ) : (
              section.data.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  canDelete={permissions.canWrite}
                  onDelete={() => setDeletingCategory(category)}
                />
              ))
            )}
          </View>
        )}
      />
      <CreateCategoryModal visible={creating} walletId={walletId} onClose={() => setCreating(false)} />
      <CategoryDeleteDialog category={deletingCategory} onClose={() => setDeletingCategory(null)} />
    </>
  );
}

function CategoryRow({
  category,
  canDelete,
  onDelete,
}: {
  category: CategoryResponse;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: category.color ?? theme.colors.textFaint }} />
      <Text style={{ flex: 1 }}>{category.name}</Text>
      {canDelete ? (
        <Pressable testID={`category-delete-${category.id}`} onPress={onDelete} hitSlop={8}>
          <Trash2 size={16} color={theme.colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

function CreateCategoryModal({
  visible,
  walletId,
  onClose,
}: {
  visible: boolean;
  walletId: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const createCategory = useCreateCategory();
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    try {
      await createCategory.mutateAsync({ walletId, name, type });
      setName('');
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card elevated style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: theme.spacing.md }}>
              <Text variant="title">New category</Text>
              <Input testID="create-category-name" label="Name" value={name} onChangeText={setName} />
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                <Button label="Expense" size="sm" variant={type === 'EXPENSE' ? 'primary' : 'secondary'} onPress={() => setType('EXPENSE')} />
                <Button label="Income" size="sm" variant={type === 'INCOME' ? 'primary' : 'secondary'} onPress={() => setType('INCOME')} />
              </View>
              {error !== null ? <Text tone="danger">{error}</Text> : null}
              <Button testID="create-category-submit" label="Create" onPress={handleCreate} loading={createCategory.isPending} disabled={name.trim().length === 0} fullWidth />
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function transactionWord(count: number): string {
  return count === 1 ? 'transaction' : 'transactions';
}

/**
 * The delete-choice dialog (API spec §10.4): the app already holds
 * `transactionCount` from the list it fetched, so it can disable "delete
 * permanently" up front instead of letting the request round-trip to find out.
 */
function CategoryDeleteDialog({
  category,
  onClose,
}: {
  category: CategoryResponse | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const updateCategory = useUpdateCategory();
  const archiveCategory = useArchiveCategory();
  const deleteCategory = useDeleteCategoryPermanently();
  const [mode, setMode] = useState<'choose' | 'rename'>('choose');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode('choose');
    setName(category?.name ?? '');
    setError(null);
  }, [category]);

  const unused = category?.transactionCount === 0;

  async function handleRename() {
    if (category === null) return;
    setError(null);
    try {
      await updateCategory.mutateAsync({ categoryId: category.id, body: { name } });
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  async function handleArchive() {
    if (category === null) return;
    setError(null);
    try {
      await archiveCategory.mutateAsync(category.id);
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  async function handleDeletePermanently() {
    if (category === null || unused !== true) return;
    setError(null);
    try {
      await deleteCategory.mutateAsync(category.id);
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <Modal visible={category !== null} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card elevated style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: theme.spacing.md }}>
              {category === null ? null : mode === 'rename' ? (
                <>
                  <Text variant="title">Rename &ldquo;{category.name}&rdquo;</Text>
                  <Input testID="category-rename-name" label="Name" value={name} onChangeText={setName} />
                  {error !== null ? <Text tone="danger">{error}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button label="Back" variant="secondary" onPress={() => setMode('choose')} style={{ flex: 1 }} />
                    <Button
                      testID="category-rename-submit"
                      label="Save"
                      onPress={handleRename}
                      loading={updateCategory.isPending}
                      disabled={name.trim().length === 0}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text variant="title">Delete &ldquo;{category.name}&rdquo;?</Text>
                  <Text tone="muted">
                    {category.transactionCount > 0
                      ? `This category is used by ${category.transactionCount} ${transactionWord(category.transactionCount)}.`
                      : 'This category has no transactions.'}
                  </Text>
                  <Text variant="label" tone="muted">
                    What would you like to do?
                  </Text>

                  <DeleteOption
                    testID="category-delete-rename"
                    icon={<Pencil size={18} color={theme.colors.text} />}
                    label="Rename category"
                    description={
                      category.transactionCount > 0
                        ? `Keep all ${category.transactionCount} ${transactionWord(category.transactionCount)}`
                        : 'Keep this category around'
                    }
                    onPress={() => setMode('rename')}
                  />
                  <DeleteOption
                    testID="category-delete-archive"
                    icon={<Archive size={18} color={theme.colors.text} />}
                    label="Archive category"
                    description="Keep historical transactions"
                    onPress={handleArchive}
                    loading={archiveCategory.isPending}
                  />
                  <DeleteOption
                    testID="category-delete-permanent"
                    icon={<Trash2 size={18} color={unused === true ? theme.colors.danger : theme.colors.textFaint} />}
                    label="Delete permanently"
                    description={
                      unused === true
                        ? 'This cannot be undone'
                        : `Only available if unused — ${category.transactionCount} ${transactionWord(category.transactionCount)} use this category`
                    }
                    onPress={handleDeletePermanently}
                    disabled={unused !== true}
                    danger
                    loading={deleteCategory.isPending}
                  />

                  {error !== null ? <Text tone="danger">{error}</Text> : null}
                  <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
                </>
              )}
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function DeleteOption({
  testID,
  icon,
  label,
  description,
  onPress,
  disabled = false,
  danger = false,
  loading = false,
}: {
  testID: string;
  icon: ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text weight="semibold" tone={danger && !disabled ? 'danger' : 'default'}>
          {label}
        </Text>
        <Text variant="caption" tone="muted">
          {description}
        </Text>
      </View>
      {loading ? <ActivityIndicator color={theme.colors.textMuted} /> : null}
    </Pressable>
  );
}
