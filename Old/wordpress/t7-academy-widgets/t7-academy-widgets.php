<?php
/**
 * Plugin Name: T7 Academy Widgets
 * Plugin URI: https://t7academy.de
 * Description: Complete suite of interactive learning widgets for T7 Academy certificates and courses
 * Version: 1.0.0
 * Author: T7 Academy
 * Author URI: https://t7academy.de
 * License: MIT
 * Text Domain: t7-academy-widgets
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('T7_WIDGETS_PATH', plugin_dir_path(__FILE__));
define('T7_WIDGETS_URL', plugin_dir_url(__FILE__));

// Register all widget blocks
add_action('init', function() {
    // Certificate widgets (1-5 stars)
    for ($i = 1; $i <= 5; $i++) {
        register_block_type(T7_WIDGETS_PATH . "blocks/{$i}-sterne-zertifikat");
    }
    
    // Other widgets
    $widgets = [
        'ginga-basic',
        'brazilian-dance',
        'fortschritt',
        'rangliste',
        'sterne-badge',
        'first-touch',
        'first-touch-air',
        'expert-zertifizierung'
    ];
    
    foreach ($widgets as $widget) {
        $block_path = T7_WIDGETS_PATH . "blocks/{$widget}";
        if (file_exists($block_path)) {
            register_block_type($block_path);
        }
    }
});

// Enqueue main stylesheet
add_action('enqueue_block_assets', function() {
    wp_enqueue_style(
        't7-widgets-main',
        T7_WIDGETS_URL . 'css/main.css',
        array(),
        '1.0.0'
    );
});

// Register shortcodes
add_shortcode('t7_widget', function($atts) {
    $atts = shortcode_atts([
        'type' => '1-sterne-zertifikat',
        'player_name' => 'Spieler',
        'player_email' => ''
    ], $atts);
    
    ob_start();
    ?>
    <div class="t7-widget" data-widget-type="<?php echo esc_attr($atts['type']); ?>"
         data-player-name="<?php echo esc_attr($atts['player_name']); ?>"
         data-player-email="<?php echo esc_attr($atts['player_email']); ?>">
        <p>Loading T7 Academy Widget...</p>
    </div>
    <script>
        (function() {
            const widget = document.currentScript.previousElementSibling;
            const type = widget.dataset.widgetType;
            const playerName = widget.dataset.playerName;
            const playerEmail = widget.dataset.playerEmail;
            
            fetch('<?php echo esc_url(T7_WIDGETS_URL); ?>widgets/' + type + '/index.html')
                .then(r => r.text())
                .then(html => {
                    widget.innerHTML = html;
                    if (window.T7InitWidget) {
                        window.T7InitWidget(widget, { playerName, playerEmail });
                    }
                });
        })();
    </script>
    <?php
    return ob_get_clean();
});

// Admin menu
add_action('admin_menu', function() {
    add_options_page(
        'T7 Academy Widgets',
        'T7 Academy',
        'manage_options',
        't7-widgets',
        function() {
            ?>
            <div class="wrap">
                <h1>T7 Academy Widgets</h1>
                <p><strong>Available Widgets:</strong></p>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li><code>[t7_widget type="1-sterne-zertifikat"]</code> - 1-Star Certificate</li>
                    <li><code>[t7_widget type="2-sterne-zertifikat"]</code> - 2-Star Certificate</li>
                    <li><code>[t7_widget type="3-sterne-zertifikat"]</code> - 3-Star Certificate</li>
                    <li><code>[t7_widget type="4-sterne-zertifikat"]</code> - 4-Star Certificate</li>
                    <li><code>[t7_widget type="5-sterne-zertifikat"]</code> - 5-Star Certificate</li>
                    <li><code>[t7_widget type="ginga-basic"]</code> - Ginga Basic</li>
                    <li><code>[t7_widget type="brazilian-dance"]</code> - Brazilian Dance</li>
                    <li><code>[t7_widget type="fortschritt"]</code> - Progress Widget</li>
                    <li><code>[t7_widget type="rangliste"]</code> - Leaderboard</li>
                    <li><code>[t7_widget type="sterne-badge"]</code> - Star Badge</li>
                    <li><code>[t7_widget type="first-touch"]</code> - First Touch</li>
                    <li><code>[t7_widget type="expert-zertifizierung"]</code> - Expert Certification</li>
                </ul>
                <p><strong>Usage:</strong></p>
                <p>Use shortcodes in your posts/pages or the Gutenberg block editor.</p>
                <p><strong>Parameters:</strong></p>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li><code>player_name</code> - Player name (default: "Spieler")</li>
                    <li><code>player_email</code> - Player email (optional)</li>
                </ul>
            </div>
            <?php
        }
    );
});
