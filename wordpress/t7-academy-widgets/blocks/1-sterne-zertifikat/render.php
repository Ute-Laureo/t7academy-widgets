<?php
$player_name = isset($attributes['playerName']) ? sanitize_text_field($attributes['playerName']) : 'Spieler';
$player_email = isset($attributes['playerEmail']) ? sanitize_email($attributes['playerEmail']) : '';
?>
<div class="wp-block-t7-1-sterne-zertifikat" data-player-name="<?php echo esc_attr($player_name); ?>" data-player-email="<?php echo esc_attr($player_email); ?>">
    <iframe src="<?php echo esc_url(plugin_dir_url(__FILE__) . '../../widgets/1-sterne-zertifikat/index.html'); ?>" 
            style="width: 100%; min-height: 600px; border: none; border-radius: 12px;" 
            title="1-Stern Zertifikat"></iframe>
</div>
