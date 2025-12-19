// =========== MAIN.JS - COMPLETE ===========

console.log('🚀 Memories App Loading...');

// Prevent duplicate loading
if (window.APP_LOADED) {
    console.warn('App already loaded, skipping');
} else {
    window.APP_LOADED = true;

    // 1. Supabase setup (FIRST THING)
    const supabase = window.supabase.createClient(
        'https://uclqlmeotirxdkbkiqne.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbHFsbWVvdGlyeGRrYmtpcW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgzNTAsImV4cCI6MjA4MTU0NDM1MH0.zXV2g_0lJS4JYuqevzqM9S65tOIK-jxLZkeFBoa4ahU'
    );

    console.log('✅ Supabase connected');

    // 2. User data
    const USERS = {
        'you': { name: 'Jayson' },
        'gf': { name: 'Kate' }
    };

    // 3. UPLOAD FUNCTION
    window.uploadMemory = async function () {
        console.log('📤 Upload button clicked');

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('image_file');
        const currentUser = localStorage.getItem('loggedInUser');

        if (!title) {
            alert('Please enter a title!');
            return;
        }

        if (!fileInput.files[0]) {
            alert('Please select an image!');
            return;
        }

        const file = fileInput.files[0];
        console.log('📁 File selected:', file.name, file.size, 'bytes');

        try {
            // 1. UPLOAD FILE TO SUPABASE STORAGE
            console.log('📤 Uploading file to storage...');

            // Create unique filename
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('memories')
                .upload(fileName, file);

            if (uploadError) {
                console.error('❌ Storage upload failed:', uploadError);
                alert('Failed to upload image: ' + uploadError.message);
                return;
            }

            console.log('✅ File uploaded to storage');

            // 2. GET PUBLIC URL OF UPLOADED FILE
            const { data: { publicUrl } } = supabase.storage
                .from('memories')
                .getPublicUrl(fileName);

            console.log('🔗 Public URL:', publicUrl);

            // 3. SAVE TO DATABASE WITH REAL IMAGE URL
            console.log('💾 Saving to database...');

            const { data, error } = await supabase
                .from('memories')
                .insert([{
                    title: title,
                    description: description || '',
                    image_url: publicUrl, // REAL image URL, not text
                    added_by: currentUser,
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                console.error('❌ Database error:', error);
                alert('Database error: ' + error.message);
                return;
            }

            console.log('✅ Memory saved with image!', data);
            alert('✅ Memory saved with image!');

            // Clear form and close modal
            document.getElementById('title').value = '';
            document.getElementById('description').value = '';
            document.getElementById('image_file').value = '';
            document.getElementById('image_preview').style.display = 'none';
            closeModal();

            // Refresh list
            loadMemories();

        } catch (error) {
            console.error('💥 Error:', error);
            alert('Something went wrong: ' + error.message);
        }
    };

    // 4. Get memories from database
    async function getMemories() {
        try {
            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('getMemories error:', error);
            return [];
        }
    }

    // 5. Display memories in grid
    async function loadMemories() {
        const memories = await getMemories();
        const container = document.getElementById('memories-container');
        const currentUser = localStorage.getItem('loggedInUser');

        if (!container) return;

        container.innerHTML = memories.map(memory => {
            const canDelete = memory.added_by === currentUser;

            return `
        <div class="memory-card">
            ${canDelete ? `
                <button class="edit-btn" onclick="editMemory('${memory.id}')" title="Edit memory">
                    ✏️
                </button>
                <button class="delete-btn" onclick="deleteMemory('${memory.id}', '${memory.image_url || ''}')" title="Delete memory">
                    🗑️
                </button>
            ` : ''}
            
            ${memory.image_url && memory.image_url.startsWith('http') ?
                `<img src="${memory.image_url}" 
                    alt="${memory.title}" 
                    onclick="openImageModal('${memory.image_url}', '${memory.title.replace(/'/g, "\\'")}')"
                    style="cursor: pointer;"
                    title="Click to view full size">` :
                `<div style="width:100%; height:300px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#999;">
                    <span>No image</span>
                </div>`
            }
            
            <div class="memory-content">
                <h3>${memory.title}</h3>
                <p>${memory.description || 'No description'}</p>
                
                <div class="memory-meta">
                    Added by ${USERS[memory.added_by]?.name || memory.added_by} • 
                    ${new Date(memory.created_at).toLocaleDateString()}
                </div>
            </div>
        </div>
    `;
        }).join('');

        console.log(`✅ Displayed ${memories.length} memories`);
    }

    window.deleteMemory = async function (memoryId, imageUrl) {
        if (!confirm('Are you sure you want to delete this memory?')) {
            return;
        }

        console.log('🗑️ Deleting memory:', memoryId);

        try {
            // 1. Delete from database
            const { error: dbError } = await supabase
                .from('memories')
                .delete()
                .eq('id', memoryId);

            if (dbError) {
                console.error('❌ Database delete error:', dbError);
                alert('Failed to delete memory from database');
                return;
            }

            console.log('✅ Database record deleted');

            // 2. Delete image from storage (if exists)
            if (imageUrl && imageUrl.includes('storage/v1/object/public/memories/')) {
                // Extract filename from URL
                const fileName = imageUrl.split('/memories/')[1];

                const { error: storageError } = await supabase.storage
                    .from('memories')
                    .remove([fileName]);

                if (storageError) {
                    console.error('⚠️ Storage delete warning:', storageError);
                    // Continue anyway - at least database record is deleted
                } else {
                    console.log('✅ Storage file deleted:', fileName);
                }
            }

            alert('Memory deleted successfully!');

            // Refresh the list
            loadMemories();

        } catch (error) {
            console.error('💥 Delete error:', error);
            alert('Error deleting memory');
        }
    };

    window.editMemory = async function (memoryId) {
        console.log('✏️ Editing memory:', memoryId);

        try {
            // Get the memory data from database
            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .eq('id', memoryId)
                .single();

            if (error) throw error;

            console.log('📄 Memory data loaded:', data);

            // Store the memory ID for updating later
            window.editingMemoryId = memoryId;
            window.currentImageUrl = data.image_url;

            // Fill the form with existing data
            document.getElementById('title').value = data.title;
            document.getElementById('description').value = data.description || '';

            // Show current image preview
            const preview = document.getElementById('image_preview');
            if (data.image_url && data.image_url.startsWith('http')) {
                preview.src = data.image_url;
                preview.style.display = 'block';
            }

            // Change modal title and button text
            document.querySelector('.modal-header h2').textContent = 'Edit Memory';
            document.getElementById('upload-btn').textContent = 'Update Memory';

            // Open modal
            openModal();

        } catch (error) {
            console.error('💥 Edit error:', error);
            alert('Failed to load memory for editing');
        }
    };

    // 7. UPDATE MEMORY FUNCTION
    window.updateMemory = async function () {
        console.log('💾 Updating memory:', window.editingMemoryId);

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('image_file');

        if (!title) {
            alert('Please enter a title!');
            return;
        }

        try {
            let imageUrl = window.currentImageUrl; // Keep existing image by default

            // If user selected a new image, upload it
            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                console.log('📁 New file selected:', file.name);

                // Upload new file
                const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('memories')
                    .upload(fileName, file);

                if (uploadError) {
                    console.error('❌ Upload failed:', uploadError);
                    alert('Failed to upload new image');
                    return;
                }

                // Get new public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('memories')
                    .getPublicUrl(fileName);

                imageUrl = publicUrl;
                console.log('✅ New image uploaded:', imageUrl);

                // Delete old image from storage
                if (window.currentImageUrl && window.currentImageUrl.includes('storage/v1/object/public/memories/')) {
                    const oldFileName = window.currentImageUrl.split('/memories/')[1];
                    await supabase.storage.from('memories').remove([oldFileName]);
                    console.log('🗑️ Old image deleted');
                }
            }

            // Update database
            const { data, error } = await supabase
                .from('memories')
                .update({
                    title: title,
                    description: description,
                    image_url: imageUrl
                })
                .eq('id', window.editingMemoryId)
                .select();

            if (error) {
                console.error('❌ Update failed:', error);
                alert('Failed to update memory');
                return;
            }

            console.log('✅ Memory updated!', data);
            alert('✅ Memory updated successfully!');

            // Reset and close
            resetModalToAddMode();
            closeModal();
            loadMemories();

        } catch (error) {
            console.error('💥 Update error:', error);
            alert('Something went wrong: ' + error.message);
        }
    };

    // 8. RESET MODAL TO "ADD" MODE
    window.resetModalToAddMode = function () {
        window.editingMemoryId = null;
        window.currentImageUrl = null;
        document.querySelector('.modal-header h2').textContent = 'Add New Memory';
        document.getElementById('upload-btn').textContent = 'Upload Memory';
    };

    // 9. Logout function
    window.logout = function () {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    };

    // 10. Auto-load memories on page load
    window.addEventListener('DOMContentLoaded', function () {
        console.log('📄 Page loaded, loading memories...');
        loadMemories();
    });

    console.log('✅ App ready!');
}